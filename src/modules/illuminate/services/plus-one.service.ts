import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { QrService } from '../../qr/qr.service';
import { IlluminateEmailService } from './illuminate-email.service';
import { ActivityLogService } from './activity-log.service';

interface CreatePlusOneDto {
  name: string;
  email: string;
  phone?: string;
  dietaryRestrictions?: string;
  specialRequests?: string;
}

interface UpdatePlusOneDto {
  name?: string;
  email?: string;
  phone?: string;
  dietaryRestrictions?: string;
  specialRequests?: string;
}

@Injectable()
export class PlusOneService {
  constructor(
    private prisma: PrismaService,
    private qrService: QrService,
    private emailService: IlluminateEmailService,
    private activityLog: ActivityLogService,
  ) {}

  // Add Plus One to a booking
  async addPlusOne(bookingId: string, dto: CreatePlusOneDto, userId?: string) {
    // Verify booking exists and is a ticket booking
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        plusOnes: true,
        seats: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.type !== 'TICKET') {
      throw new BadRequestException(
        'Plus Ones can only be added to ticket bookings',
      );
    }

    // Check if booking already has a Plus One
    if (booking.plusOnes.length > 0) {
      throw new BadRequestException(
        'This booking already has a Plus One. Please remove the existing Plus One first.',
      );
    }

    // Check if booking has confirmed status
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Booking must be confirmed before adding a Plus One',
      );
    }

    // Generate unique QR code
    const qrCode = await this.generateUniquePlusOneQrCode();

    // Create Plus One
    const plusOne = await this.prisma.illuminatePlusOne.create({
      data: {
        bookingId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        dietaryRestrictions: dto.dietaryRestrictions,
        specialRequests: dto.specialRequests,
        qrCode,
      },
    });

    // Assign seat adjacent to main attendee
    if (booking.seatNumbers.length > 0) {
      const adjacentSeat = await this.findAdjacentSeat(
        booking.seatNumbers[0],
        bookingId,
      );
      if (adjacentSeat) {
        await this.assignSeatToPlusOne(plusOne.id, adjacentSeat);

        // Send confirmation email ONLY AFTER seat is assigned
        const updatedBooking = await this.prisma.booking.findUnique({
          where: { id: bookingId },
          include: {
            plusOnes: true,
            seats: true,
          },
        });

        const updatedPlusOne = await this.prisma.illuminatePlusOne.findUnique({
          where: { id: plusOne.id },
        });

        await this.emailService.sendPlusOneConfirmation(
          updatedBooking!,
          updatedPlusOne!,
        );
      }
    }

    // Log activity
    await this.activityLog.log({
      action: 'plus_one_added',
      entityType: 'BOOKING',
      entityId: bookingId,
      userId,
      details: { plusOneId: plusOne.id, name: dto.name, email: dto.email },
    });

    return {
      success: true,
      plusOne,
      message:
        booking.seatNumbers.length > 0
          ? 'Plus One added successfully. Confirmation email sent with seat assignment.'
          : 'Plus One added successfully. Confirmation email will be sent when seats are assigned.',
    };
  }

  // Update Plus One
  async updatePlusOne(
    plusOneId: string,
    dto: UpdatePlusOneDto,
    userId?: string,
  ) {
    const plusOne = await this.prisma.illuminatePlusOne.findUnique({
      where: { id: plusOneId },
      include: { booking: true },
    });

    if (!plusOne) {
      throw new NotFoundException('Plus One not found');
    }

    const updated = await this.prisma.illuminatePlusOne.update({
      where: { id: plusOneId },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        dietaryRestrictions: dto.dietaryRestrictions,
        specialRequests: dto.specialRequests,
      },
    });

    await this.activityLog.log({
      action: 'plus_one_updated',
      entityType: 'BOOKING',
      entityId: plusOne.bookingId,
      userId,
      details: { plusOneId, changes: dto },
    });

    return {
      success: true,
      plusOne: updated,
    };
  }

  // Delete Plus One
  async deletePlusOne(plusOneId: string, userId?: string) {
    const plusOne = await this.prisma.illuminatePlusOne.findUnique({
      where: { id: plusOneId },
      include: { booking: true },
    });

    if (!plusOne) {
      throw new NotFoundException('Plus One not found');
    }

    // Release seat if assigned
    if (plusOne.seatNumber) {
      await this.prisma.seat.updateMany({
        where: { seatNumber: plusOne.seatNumber },
        data: {
          isAvailable: true,
          bookingId: null,
          plusOneId: null, // Clear Plus One reference
          reservedAt: null,
        },
      });
    }

    await this.prisma.illuminatePlusOne.delete({
      where: { id: plusOneId },
    });

    await this.activityLog.log({
      action: 'plus_one_deleted',
      entityType: 'BOOKING',
      entityId: plusOne.bookingId,
      userId,
      details: { plusOneId, name: plusOne.name },
    });

    return {
      success: true,
      message: 'Plus One removed successfully',
    };
  }

  // Resend Plus One confirmation email
  async resendPlusOneEmail(plusOneId: string, userId?: string) {
    const plusOne = await this.prisma.illuminatePlusOne.findUnique({
      where: { id: plusOneId },
      include: {
        booking: {
          include: {
            seats: true,
            plusOnes: true,
          },
        },
      },
    });

    if (!plusOne) {
      throw new NotFoundException('Plus One not found');
    }

    await this.emailService.sendPlusOneConfirmation(plusOne.booking, plusOne);

    await this.activityLog.log({
      action: 'plus_one_email_resent',
      entityType: 'BOOKING',
      entityId: plusOne.bookingId,
      userId,
      details: { plusOneId, email: plusOne.email },
    });

    return {
      success: true,
      message: 'Confirmation email resent successfully',
    };
  }

  // Check in Plus One
  async checkInPlusOne(qrCode: string) {
    const plusOne = await this.prisma.illuminatePlusOne.findUnique({
      where: { qrCode },
      include: {
        booking: true,
      },
    });

    if (!plusOne) {
      throw new NotFoundException('Plus One not found');
    }

    if (plusOne.checkedIn) {
      return {
        success: false,
        message: 'Plus One already checked in',
        checkedInAt: plusOne.checkedInAt,
      };
    }

    const updated = await this.prisma.illuminatePlusOne.update({
      where: { id: plusOne.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
      },
      include: {
        booking: true,
      },
    });

    await this.activityLog.log({
      action: 'plus_one_checked_in',
      entityType: 'BOOKING',
      entityId: plusOne.bookingId,
      details: { plusOneId: plusOne.id, name: plusOne.name, qrCode },
    });

    return {
      success: true,
      plusOne: updated,
      message: 'Plus One checked in successfully',
    };
  }

  // Verify Plus One QR code
  async verifyPlusOneQr(qrCode: string) {
    const plusOne = await this.prisma.illuminatePlusOne.findUnique({
      where: { qrCode },
      include: {
        booking: true,
      },
    });

    if (!plusOne) {
      return {
        valid: false,
        message: 'Invalid QR code',
      };
    }

    return {
      valid: true,
      plusOne: {
        id: plusOne.id,
        name: plusOne.name,
        email: plusOne.email,
        seatNumber: plusOne.seatNumber,
        checkedIn: plusOne.checkedIn,
        checkedInAt: plusOne.checkedInAt,
        mainAttendeeName: plusOne.booking.customerName,
      },
    };
  }

  // Helper: Generate unique QR code for Plus One
  private async generateUniquePlusOneQrCode(): Promise<string> {
    let qrCode: string;
    let exists = true;

    while (exists) {
      qrCode = `PLO-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const existing = await this.prisma.illuminatePlusOne.findUnique({
        where: { qrCode },
      });
      exists = !!existing;
    }

    return qrCode!;
  }

  // Helper: Find adjacent seat to main attendee
  private async findAdjacentSeat(
    mainSeatNumber: string,
    bookingId: string,
  ): Promise<string | null> {
    // Parse seat number (e.g., "T5-01" -> table: 5, seat: 1)
    const match = mainSeatNumber.match(/^T(\d+)-(\d+)$/);
    if (!match) return null;

    const tableNum = match[1];
    const seatNum = parseInt(match[2], 10);

    // Try adjacent seats in order: +1, -1, +2, -2, etc.
    const adjacentOffsets = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5];

    for (const offset of adjacentOffsets) {
      const adjacentSeatNum = seatNum + offset;
      if (adjacentSeatNum < 1) continue; // Skip invalid seat numbers

      const adjacentSeatNumber = `T${tableNum}-${adjacentSeatNum.toString().padStart(2, '0')}`;

      // Check if seat exists and is available
      const seat = await this.prisma.seat.findFirst({
        where: {
          seatNumber: adjacentSeatNumber,
          isAvailable: true,
        },
      });

      if (seat) {
        return adjacentSeatNumber;
      }
    }

    // Fallback: Find any available seat at the same table
    const anySeatAtTable = await this.prisma.seat.findFirst({
      where: {
        tableNumber: tableNum,
        isAvailable: true,
      },
      orderBy: {
        seatNumber: 'asc',
      },
    });

    return anySeatAtTable?.seatNumber || null;
  }

  // Helper: Assign seat to Plus One
  private async assignSeatToPlusOne(plusOneId: string, seatNumber: string) {
    const plusOne = await this.prisma.illuminatePlusOne.findUnique({
      where: { id: plusOneId },
    });

    if (!plusOne) return;

    // Update Plus One with seat number
    await this.prisma.illuminatePlusOne.update({
      where: { id: plusOneId },
      data: { seatNumber },
    });

    // Mark seat as reserved and link to Plus One (not just booking)
    await this.prisma.seat.updateMany({
      where: { seatNumber },
      data: {
        isAvailable: false,
        bookingId: plusOne.bookingId,
        plusOneId: plusOneId, // Link seat to Plus One
        reservedAt: new Date(),
      },
    });
  }
}
