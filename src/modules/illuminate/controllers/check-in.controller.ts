import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CheckInService } from '../services/check-in.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

/**
 * Gala check-in. `checkin` staff are allowed here alongside admins — they are
 * the ones working the door.
 *
 * `:code` is whatever the scanner read: a booking id for the main ticket
 * holder, or a `PLO-…` code for a plus one.
 */
@Controller('illuminate/check-in')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin', 'checkin')
  async getStats() {
    return this.checkInService.getStats();
  }

  @Get(':code/verify')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin', 'checkin')
  async verify(@Param('code') code: string) {
    return this.checkInService.verify(code);
  }

  @Post(':code')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin', 'checkin')
  @HttpCode(HttpStatus.OK)
  async checkIn(@Param('code') code: string, @Req() req: any) {
    return this.checkInService.checkIn(code, req.user?.id);
  }

  @Delete(':code')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async undoCheckIn(@Param('code') code: string, @Req() req: any) {
    return this.checkInService.undoCheckIn(code, req.user?.id);
  }
}
