import { Controller, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { QrService } from './qr.service';
import { Attendee } from '@prisma/client';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

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

  // Limited validation for check-in staff (no sensitive data)
  @Get('validate-checkin/:qrCode')
  @UseGuards(RolesGuard)
  @Roles('admin', 'checkin')
  async validateQrCodeForCheckin(@Param('qrCode') qrCode: string, @Request() req): Promise<{
    valid: boolean;
    attendee?: any;
    message?: string;
  }> {
    try {
      const attendee = await this.qrService.validateQrCode(qrCode);
      
      // Return limited data for check-in staff
      const limitedData = {
        id: attendee.id,
        name: attendee.name,
        company: attendee.company,
        title: attendee.title,
        registrationId: attendee.registrationId,
        status: attendee.status,
        eventId: attendee.eventId,
        checkedInAt: attendee.checkedInAt,
        alreadyCheckedIn: !!attendee.checkedInAt,
        // Only include email for admin role
        ...(req.user.role === 'admin' && { email: attendee.email }),
        // Include plus one info if exists (without email for checkin role)
        ...(attendee.plusOne && {
          plusOne: {
            name: attendee.plusOne.name,
            company: attendee.plusOne.company,
            title: attendee.plusOne.title,
            ...(req.user.role === 'admin' && { email: attendee.plusOne.email }),
          }
        }),
        event: attendee.event,
      };

      return {
        valid: true,
        attendee: limitedData,
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message,
      };
    }
  }

  @Post('check-in/:qrCode')
  async checkInAttendee(@Param('qrCode') qrCode: string): Promise<{
    success: boolean;
    attendee?: any;
    message?: string;
  }> {
    try {
      const result = await this.qrService.checkInAttendee(qrCode);
      return {
        success: true,
        attendee: result,
        message: 'Check-in successful',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Role-based check-in endpoint
  @Post('check-in-secure/:qrCode')
  @UseGuards(RolesGuard)
  @Roles('admin', 'checkin')
  async checkInAttendeeSecure(@Param('qrCode') qrCode: string, @Request() req): Promise<{
    success: boolean;
    attendee?: any;
    message?: string;
  }> {
    try {
      const result = await this.qrService.checkInAttendee(qrCode);
      
      // Return limited data for check-in staff
      const limitedData = {
        id: result.id,
        name: result.name,
        company: result.company,
        title: result.title,
        registrationId: result.registrationId,
        status: result.status,
        eventId: result.eventId,
        checkedInAt: result.checkedInAt,
        // Only include email for admin role
        ...(req.user.role === 'admin' && { email: result.email }),
        // Include plus one info if exists (without email for checkin role)
        ...(result.plusOne && {
          plusOne: {
            name: result.plusOne.name,
            company: result.plusOne.company,
            title: result.plusOne.title,
            ...(req.user.role === 'admin' && { email: result.plusOne.email }),
          }
        }),
        event: result.event,
      };

      return {
        success: true,
        attendee: limitedData,
        message: 'Check-in successful',
      };
    } catch (error) {
      return {
        success: false,
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
