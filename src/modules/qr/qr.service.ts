import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SheetsService } from '../sheets/sheets.service';
import { Attendee } from '@prisma/client';
import * as QRCode from 'qrcode';

@Injectable()
export class QrService {
  constructor(
    private prisma: PrismaService,
    private sheetsService: SheetsService,
  ) {}

  async validateQrCode(qrCode: string): Promise<Attendee | any> {
    // First try to find as attendee
    const attendee = await this.prisma.attendee.findUnique({
      where: { qrCode },
      include: {
        event: true,
        plusOne: true,
        invite: true,
      },
    });

    if (attendee) {
      return {
        ...attendee,
        alreadyCheckedIn: !!attendee.checkedInAt,
      };
    }

    // If not found, try to find as plus-one
    const plusOne = await this.prisma.plusOne.findUnique({
      where: { qrCode },
      include: {
        attendee: {
          include: {
            event: true,
          },
        },
      },
    });

    if (plusOne) {
      // Return plus-one data in a format similar to attendee
      return {
        id: plusOne.id,
        name: plusOne.name,
        company: plusOne.company,
        title: plusOne.title,
        email: plusOne.email,
        registrationId: plusOne.registrationId,
        qrCode: plusOne.qrCode,
        status: 'PLUS_ONE',
        checkedInAt: plusOne.checkedInAt,
        alreadyCheckedIn: !!plusOne.checkedInAt,
        event: plusOne.attendee.event,
        eventId: plusOne.attendee.eventId,
        primaryAttendee: {
          name: plusOne.attendee.name,
          email: plusOne.attendee.email,
        },
      };
    }

    throw new NotFoundException('Invalid QR code');
  }

  async checkInAttendee(qrCode: string): Promise<any> {
    // First try to find as attendee
    const attendee = await this.prisma.attendee.findUnique({
      where: { qrCode },
      include: {
        event: true,
        plusOne: true,
        invite: true,
      },
    });

    if (attendee) {
      // Check if already checked in
      if (attendee.checkedInAt) {
        throw new BadRequestException('Attendee already checked in');
      }

      // Update check-in time
      const updatedAttendee = await this.prisma.attendee.update({
        where: { id: attendee.id },
        data: { checkedInAt: new Date() },
        include: {
          event: true,
          plusOne: true,
          invite: true,
        },
      });

      // Update Google Sheets
      await this.sheetsService.updateCheckInStatus(updatedAttendee.registrationId, true);

      return {
        ...updatedAttendee,
        alreadyCheckedIn: false,
        justCheckedIn: true,
      };
    }

    // If not found, try to find as plus-one
    const plusOne = await this.prisma.plusOne.findUnique({
      where: { qrCode },
      include: {
        attendee: {
          include: {
            event: true,
          },
        },
      },
    });

    if (plusOne) {
      // Check if already checked in
      if (plusOne.checkedInAt) {
        throw new BadRequestException('Plus-one already checked in');
      }

      // Update check-in time
      const updatedPlusOne = await this.prisma.plusOne.update({
        where: { id: plusOne.id },
        data: { checkedInAt: new Date() },
        include: {
          attendee: {
            include: {
              event: true,
            },
          },
        },
      });

      // Update Google Sheets
      await this.sheetsService.updateCheckInStatus(updatedPlusOne.registrationId, true);

      return {
        id: updatedPlusOne.id,
        name: updatedPlusOne.name,
        company: updatedPlusOne.company,
        title: updatedPlusOne.title,
        email: updatedPlusOne.email,
        registrationId: updatedPlusOne.registrationId,
        qrCode: updatedPlusOne.qrCode,
        status: 'PLUS_ONE',
        checkedInAt: updatedPlusOne.checkedInAt,
        alreadyCheckedIn: false,
        justCheckedIn: true,
        event: updatedPlusOne.attendee.event,
        eventId: updatedPlusOne.attendee.eventId,
        primaryAttendee: {
          name: updatedPlusOne.attendee.name,
          email: updatedPlusOne.attendee.email,
        },
      };
    }

    throw new NotFoundException('Invalid QR code');
  }

  async generateQrCodeImage(data: string): Promise<string> {
    try {
      // Generate QR code as data URL (base64)
      const qrCodeDataUrl = await QRCode.toDataURL(data, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
      });
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  async getAttendeeQrCode(attendeeId: string): Promise<{
    qrCode: string;
    qrCodeImage: string;
    attendee: Attendee;
  }> {
    const attendee = await this.prisma.attendee.findUnique({
      where: { id: attendeeId },
      include: {
        event: true,
        plusOne: true,
      },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    const qrCodeImage = await this.generateQrCodeImage(attendee.qrCode);

    return {
      qrCode: attendee.qrCode,
      qrCodeImage,
      attendee,
    };
  }

  async getPlusOneQrCode(plusOneId: string): Promise<{
    qrCode: string;
    qrCodeImage: string;
    plusOne: any;
  }> {
    const plusOne = await this.prisma.plusOne.findUnique({
      where: { id: plusOneId },
      include: {
        attendee: {
          include: {
            event: true,
          },
        },
      },
    });

    if (!plusOne) {
      throw new NotFoundException('Plus-one not found');
    }

    const qrCodeImage = await this.generateQrCodeImage(plusOne.qrCode);

    return {
      qrCode: plusOne.qrCode,
      qrCodeImage,
      plusOne: {
        ...plusOne,
        event: plusOne.attendee.event,
      },
    };
  }
}
