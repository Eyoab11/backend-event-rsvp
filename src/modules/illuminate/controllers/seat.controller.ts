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
import { SeatService } from '../services/seat.service';
import { CreateSeatDto, BulkCreateSeatsDto, UpdateSeatDto } from '../dto/create-seat.dto';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@Controller('illuminate/seats')
export class SeatController {
  constructor(private readonly seatService: SeatService) {}

  // ADMIN ENDPOINTS

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async getSeats(
    @Query('seatType') seatType?: string,
    @Query('isAvailable') isAvailable?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.seatService.getSeats({
      seatType,
      isAvailable: isAvailable ? isAvailable === 'true' : undefined,
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('availability-overview')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async getSeatAvailabilityOverview() {
    return this.seatService.getSeatAvailabilityOverview();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async getSeatById(@Param('id') id: string) {
    return this.seatService.getSeatById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createSeat(@Body() dto: CreateSeatDto, @Req() req: any) {
    const userId = req.user?.id;
    return this.seatService.createSeat(dto, userId);
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async bulkCreateSeats(@Body() dto: BulkCreateSeatsDto, @Req() req: any) {
    const userId = req.user?.id;
    return this.seatService.bulkCreateSeats(dto, userId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async updateSeat(
    @Param('id') id: string,
    @Body() dto: UpdateSeatDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.seatService.updateSeat(id, dto, userId);
  }

  @Patch(':id/release')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async releaseSeat(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.seatService.releaseSeat(id, userId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('super_admin')
  @HttpCode(HttpStatus.OK)
  async deleteSeat(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.seatService.deleteSeat(id, userId);
  }
}
