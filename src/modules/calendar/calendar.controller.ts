import { Controller, Get, Param, Header, NotFoundException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('attendee/:attendeeId')
  @Header('Content-Type', 'text/calendar')
  async getAttendeeCalendar(@Param('attendeeId') attendeeId: string) {
    // Fetch attendee with event data
    const attendee = await this.prisma.attendee.findUnique({
      where: { id: attendeeId },
      include: {
        event: true,
      },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    // Generate calendar file
    const icsContent = this.calendarService.generateCalendarFile({
      event: attendee.event,
      attendee,
    });

    // Generate filename
    const filename = this.calendarService.generateFilename(
      attendee.event.eventName,
      attendee.name,
    );

    // Set content disposition header for download
    return {
      content: icsContent,
      filename,
    };
  }

  @Get('attendee/:attendeeId/download')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async downloadAttendeeCalendar(@Param('attendeeId') attendeeId: string) {
    // Fetch attendee with event data
    const attendee = await this.prisma.attendee.findUnique({
      where: { id: attendeeId },
      include: {
        event: true,
      },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    // Generate calendar file
    const icsContent = this.calendarService.generateCalendarFile({
      event: attendee.event,
      attendee,
    });

    // Generate filename
    const filename = this.calendarService.generateFilename(
      attendee.event.eventName,
      attendee.name,
    );

    // Return raw ICS content with proper headers
    // The @Header decorator above sets Content-Type
    // We need to set Content-Disposition in the response
    return icsContent;
  }
}
