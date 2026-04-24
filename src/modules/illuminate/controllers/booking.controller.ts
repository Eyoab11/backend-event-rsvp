import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import {
  CreateTicketBookingDto,
  CreateSponsorInquiryDto,
  UpdateBookingDto,
  AssignSeatsDto,
  UpdateSeatAssignmentsDto,
} from '../dto/create-booking.dto';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@Controller('illuminate/bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // PUBLIC ENDPOINTS

  @Post('ticket')
  @HttpCode(HttpStatus.CREATED)
  async createTicketBooking(@Body() dto: CreateTicketBookingDto, @Req() req: any) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.bookingService.createTicketBooking(dto, ipAddress);
  }

  @Post('sponsor')
  @HttpCode(HttpStatus.CREATED)
  async createSponsorInquiry(@Body() dto: CreateSponsorInquiryDto, @Req() req: any) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.bookingService.createSponsorInquiry(dto, ipAddress);
  }

  @Get(':id/verify')
  async verifyBooking(@Param('id') id: string) {
    return this.bookingService.verifyBooking(id);
  }

  // ADMIN ENDPOINTS

  @Post('admin')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createAdminBooking(@Body() dto: CreateTicketBookingDto, @Req() req: any) {
    const userId = req.user?.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.bookingService.createAdminBooking(dto, userId, ipAddress);
  }

  @Post('admin/sponsor')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createAdminSponsorInquiry(@Body() dto: CreateSponsorInquiryDto, @Req() req: any) {
    const userId = req.user?.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.bookingService.createAdminSponsorInquiry(dto, userId, ipAddress);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async listBookings(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.bookingService.listBookings({
      type,
      status,
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async getBookingById(@Param('id') id: string) {
    return this.bookingService.getBookingById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async updateBooking(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.bookingService.updateBooking(id, dto, userId);
  }

  @Post(':id/assign-seats')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async assignSeats(
    @Param('id') id: string,
    @Body() dto: AssignSeatsDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.bookingService.assignSeats(id, dto, userId);
  }

  @Post(':id/auto-assign')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async autoAssignSeats(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.bookingService.manualAutoAssign(id, userId);
  }

  @Patch(':id/seat-assignments')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async updateSeatAssignments(
    @Param('id') id: string,
    @Body() dto: UpdateSeatAssignmentsDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.bookingService.updateSeatAssignments(id, dto.seatAssignments, userId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async deleteBooking(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.bookingService.deleteBooking(id, userId);
  }
}
