import { Controller, Get, Param, Delete, Header, Post } from '@nestjs/common';
import { AdminService, EventStats, DashboardStats } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard-stats')
  async getDashboardStats(): Promise<DashboardStats> {
    return this.adminService.getDashboardStats();
  }

  @Get('events/:eventId/attendees')
  async getAttendees(@Param('eventId') eventId: string) {
    return this.adminService.getAttendees(eventId);
  }

  @Get('events/:eventId/stats')
  async getEventStats(@Param('eventId') eventId: string): Promise<EventStats> {
    return this.adminService.getEventStats(eventId);
  }

  @Get('events/:eventId/export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="attendees.csv"')
  async exportAttendees(@Param('eventId') eventId: string): Promise<string> {
    return this.adminService.exportAttendees(eventId);
  }

  @Get('sheets/url')
  async getSheetUrl(): Promise<{ url: string | null }> {
    return this.adminService.getSheetUrl();
  }

  @Post('sheets/initialize')
  async initializeSheet(): Promise<{ message: string }> {
    return this.adminService.initializeSheet();
  }

  @Delete('attendees/:attendeeId')
  async cancelAttendee(
    @Param('attendeeId') attendeeId: string,
  ): Promise<{ message: string }> {
    await this.adminService.cancelAttendee(attendeeId);
    return { message: 'Attendee cancelled successfully' };
  }
}

