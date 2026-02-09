import { Controller, Get, Param } from '@nestjs/common';
import { QrService } from './qr.service';
import { Attendee } from '@prisma/client';

@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Get('validate/:qrCode')
  async validateQrCode(@Param('qrCode') qrCode: string): Promise<{
    valid: boolean;
    attendee?: Attendee;
    message?: string;
  }> {
    try {
      const attendee = await this.qrService.validateQrCode(qrCode);
      return {
        valid: true,
        attendee,
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message,
      };
    }
  }

  @Get('attendee/:attendeeId')
  async getAttendeeQrCode(@Param('attendeeId') attendeeId: string) {
    return this.qrService.getAttendeeQrCode(attendeeId);
  }

  @Get('plusone/:plusOneId')
  async getPlusOneQrCode(@Param('plusOneId') plusOneId: string) {
    return this.qrService.getPlusOneQrCode(plusOneId);
  }
}
