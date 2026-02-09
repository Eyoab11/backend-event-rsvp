import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InviteService } from '../invite/invite.service';
import { EmailService } from '../email/email.service';
import { CalendarService } from '../calendar/calendar.service';
import { SheetsService } from '../sheets/sheets.service';
import { QrService } from '../qr/qr.service';
import { Attendee, AttendeeStatus, Event } from '@prisma/client';
import { CreateRsvpDto } from './dto/create-rsvp.dto';
import { randomBytes } from 'crypto';

export interface RegistrationResponseDto {
  attendee: {
    id: string;
    name: string;
    company: string;
    title: string;
    email: string;
    status: AttendeeStatus;
    registrationId: string;
    qrCode: string;
  };
  plusOne?: {
    name: string;
    company: string;
    title: string;
    email: string;
  };
  event: {
    id: string;
    eventName: string;
    eventDate: Date;
    eventStartTime: string;
    eventEndTime: string;
    venueName: string;
    venueAddress: string;
    venueCity: string;
    venueState: string;
    venueZipCode: string;
    capacity: number;
    currentRegistrations: number;
    dressCode: string;
  };
  isWaitlisted: boolean;
}

@Injectable()
export class RsvpService {
  constructor(
    private prisma: PrismaService,
    private inviteService: InviteService,
    private emailService: EmailService,
    private calendarService: CalendarService,
    private sheetsService: SheetsService,
    private qrService: QrService,
  ) {}

  async submitRsvp(rsvpData: CreateRsvpDto): Promise<RegistrationResponseDto> {
    // 1. Validate the invite token
    const invite = await this.inviteService.validateToken(rsvpData.token);
    
    // 2. Check if token is already used (double-check)
    if (invite.isUsed) {
      throw new BadRequestException('This invite has already been used');
    }

    // 3. Check capacity
    const requiredSlots = rsvpData.plusOne ? 2 : 1;
    const hasCapacity = await this.checkCapacity(invite.eventId, rsvpData.plusOne !== undefined);
    
    // 4. Determine status based on capacity
    const status = hasCapacity ? AttendeeStatus.CONFIRMED : AttendeeStatus.WAITLISTED;

    // 5. Generate unique identifiers
    const registrationId = this.generateRegistrationId();
    const qrCode = this.generateQrCode();

    // 6. Create attendee and plus-one in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the attendee
      const attendee = await tx.attendee.create({
        data: {
          name: rsvpData.name,
          company: rsvpData.company,
          title: rsvpData.title,
          email: rsvpData.email,
          status,
          qrCode,
          registrationId,
          inviteId: invite.id,
          eventId: invite.eventId,
        },
      });

      // Create plus-one if provided
      let plusOne: any = null;
      if (rsvpData.plusOne) {
        const plusOneQrCode = this.generateQrCode();
        const plusOneRegistrationId = `${registrationId}-P1`;
        
        plusOne = await tx.plusOne.create({
          data: {
            name: rsvpData.plusOne.name,
            company: rsvpData.plusOne.company,
            title: rsvpData.plusOne.title,
            email: rsvpData.plusOne.email,
            qrCode: plusOneQrCode,
            registrationId: plusOneRegistrationId,
            attendeeId: attendee.id,
          },
        });
      }

      // Mark invite as used
      await tx.invite.update({
        where: { id: invite.id },
        data: { isUsed: true },
      });

      // Update event capacity if confirmed
      if (status === AttendeeStatus.CONFIRMED) {
        await tx.event.update({
          where: { id: invite.eventId },
          data: {
            currentRegistrations: {
              increment: requiredSlots,
            },
          },
        });
      }

      return { attendee, plusOne };
    });

    // 7. Get updated event data
    const event = await this.prisma.event.findUnique({
      where: { id: invite.eventId },
    });

    if (!event) {
      throw new BadRequestException('Event not found');
    }

    // 8. Send confirmation or waitlist email
    try {
      if (status === AttendeeStatus.CONFIRMED) {
        // Generate calendar file
        const calendarFile = this.calendarService.generateCalendarFile({
          event,
          attendee: result.attendee,
        });

        // Generate QR code image for primary attendee
        const attendeeQrCodeImage = await this.qrService.generateQrCodeImage(result.attendee.qrCode);

        // Send confirmation email to primary attendee
        await this.emailService.sendConfirmationEmail({
          event,
          attendee: result.attendee,
          plusOne: result.plusOne,
          qrCodeImage: attendeeQrCodeImage,
          calendarFile,
        });

        // Send separate confirmation email to plus-one if exists
        if (result.plusOne) {
          // Generate QR code image for plus-one
          const plusOneQrCodeImage = await this.qrService.generateQrCodeImage(result.plusOne.qrCode);
          
          await this.emailService.sendPlusOneConfirmationEmail({
            event,
            plusOne: result.plusOne,
            primaryAttendeeName: result.attendee.name,
            qrCodeImage: plusOneQrCodeImage,
            calendarFile,
          });
        }
      } else {
        // Send waitlist email
        await this.emailService.sendWaitlistEmail({
          event,
          attendee: result.attendee,
          plusOne: result.plusOne,
        });
      }
    } catch (emailError) {
      // Log error but don't fail the registration
      console.error('Failed to send email:', emailError);
    }

    // 9. Sync to Google Sheets
    try {
      await this.sheetsService.addAttendeeToSheet(
        result.attendee,
        result.plusOne,
        event.eventName,
      );
    } catch (sheetsError) {
      // Log error but don't fail the registration
      console.error('Failed to sync to Google Sheets:', sheetsError);
    }

    // 10. Format response
    return {
      attendee: {
        id: result.attendee.id,
        name: result.attendee.name,
        company: result.attendee.company,
        title: result.attendee.title,
        email: result.attendee.email,
        status: result.attendee.status,
        registrationId: result.attendee.registrationId,
        qrCode: result.attendee.qrCode,
      },
      plusOne: result.plusOne ? {
        name: result.plusOne.name,
        company: result.plusOne.company,
        title: result.plusOne.title,
        email: result.plusOne.email,
      } : undefined,
      event: {
        id: event.id,
        eventName: event.eventName,
        eventDate: event.eventDate,
        eventStartTime: event.eventStartTime,
        eventEndTime: event.eventEndTime,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
        venueCity: event.venueCity,
        venueState: event.venueState,
        venueZipCode: event.venueZipCode,
        capacity: event.capacity,
        currentRegistrations: event.currentRegistrations,
        dressCode: event.dressCode,
      },
      isWaitlisted: status === AttendeeStatus.WAITLISTED,
    };
  }

  async checkCapacity(eventId: string, includesPlusOne: boolean): Promise<boolean> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new BadRequestException('Event not found');
    }

    const requiredSlots = includesPlusOne ? 2 : 1;
    const availableSlots = event.capacity - event.currentRegistrations;

    return availableSlots >= requiredSlots;
  }

  async getRegistrationDetails(attendeeId: string): Promise<RegistrationResponseDto> {
    const attendee = await this.prisma.attendee.findUnique({
      where: { id: attendeeId },
      include: {
        event: true,
        plusOne: true,
      },
    });

    if (!attendee) {
      throw new BadRequestException('Registration not found');
    }

    return {
      attendee: {
        id: attendee.id,
        name: attendee.name,
        company: attendee.company,
        title: attendee.title,
        email: attendee.email,
        status: attendee.status,
        registrationId: attendee.registrationId,
        qrCode: attendee.qrCode,
      },
      plusOne: attendee.plusOne ? {
        name: attendee.plusOne.name,
        company: attendee.plusOne.company,
        title: attendee.plusOne.title,
        email: attendee.plusOne.email,
      } : undefined,
      event: {
        id: attendee.event.id,
        eventName: attendee.event.eventName,
        eventDate: attendee.event.eventDate,
        eventStartTime: attendee.event.eventStartTime,
        eventEndTime: attendee.event.eventEndTime,
        venueName: attendee.event.venueName,
        venueAddress: attendee.event.venueAddress,
        venueCity: attendee.event.venueCity,
        venueState: attendee.event.venueState,
        venueZipCode: attendee.event.venueZipCode,
        capacity: attendee.event.capacity,
        currentRegistrations: attendee.event.currentRegistrations,
        dressCode: attendee.event.dressCode,
      },
      isWaitlisted: attendee.status === AttendeeStatus.WAITLISTED,
    };
  }

  async cancelRsvp(attendeeId: string): Promise<void> {
    const attendee = await this.prisma.attendee.findUnique({
      where: { id: attendeeId },
      include: { plusOne: true },
    });

    if (!attendee) {
      throw new BadRequestException('Registration not found');
    }

    if (attendee.status === AttendeeStatus.CANCELLED) {
      throw new BadRequestException('Registration is already cancelled');
    }

    const slotsToFree = attendee.plusOne ? 2 : 1;

    await this.prisma.$transaction(async (tx) => {
      // Update attendee status
      await tx.attendee.update({
        where: { id: attendeeId },
        data: { status: AttendeeStatus.CANCELLED },
      });

      // Free up capacity if was confirmed
      if (attendee.status === AttendeeStatus.CONFIRMED) {
        await tx.event.update({
          where: { id: attendee.eventId },
          data: {
            currentRegistrations: {
              decrement: slotsToFree,
            },
          },
        });
      }
    });
  }

  private generateRegistrationId(): string {
    const timestamp = Date.now().toString().slice(-8);
    return `REG-${timestamp}`;
  }

  private generateQrCode(): string {
    return randomBytes(16).toString('hex');
  }
}
