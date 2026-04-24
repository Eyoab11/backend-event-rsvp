import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { ActivityLogService } from '../services/activity-log.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@Controller('illuminate/admin')
@UseGuards(RolesGuard)
@Roles('admin', 'super_admin')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @Get('dashboard/stats')
  async getDashboardStats() {
    return this.dashboardService.getDashboardStats();
  }

  @Get('dashboard/bookings-by-status')
  async getBookingsByStatus() {
    return this.dashboardService.getBookingsByStatus();
  }

  @Get('dashboard/bookings-by-type')
  async getBookingsByType() {
    return this.dashboardService.getBookingsByType();
  }

  @Get('dashboard/revenue-over-time')
  async getRevenueOverTime() {
    return this.dashboardService.getRevenueOverTime();
  }

  @Get('activity-log')
  async getActivityLog(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityLogService.getLogs({
      entityType,
      entityId,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('export/bookings')
  async exportBookings(
    @Res() res: Response,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const csv = await this.dashboardService.exportBookings({
      type,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bookings-export.csv');
    res.status(HttpStatus.OK).send(csv);
  }
}
