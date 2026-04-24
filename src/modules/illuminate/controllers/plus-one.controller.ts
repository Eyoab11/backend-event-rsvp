import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlusOneService } from '../services/plus-one.service';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@Controller('illuminate')
export class PlusOneController {
  constructor(private readonly plusOneService: PlusOneService) {}

  // ADMIN ENDPOINTS

  @Post('bookings/:id/plus-ones')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async addPlusOne(
    @Param('id') bookingId: string,
    @Body() dto: {
      name: string;
      email: string;
      phone?: string;
      dietaryRestrictions?: string;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.plusOneService.addPlusOne(bookingId, dto, userId);
  }

  @Patch('plus-ones/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async updatePlusOne(
    @Param('id') id: string,
    @Body() dto: {
      name?: string;
      email?: string;
      phone?: string;
      dietaryRestrictions?: string;
    },
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.plusOneService.updatePlusOne(id, dto, userId);
  }

  @Delete('plus-ones/:id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async deletePlusOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.plusOneService.deletePlusOne(id, userId);
  }

  @Post('plus-ones/:id/resend-email')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async resendPlusOneEmail(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.plusOneService.resendPlusOneEmail(id, userId);
  }

  // CHECK-IN ENDPOINTS

  @Post('check-in/plus-one/:qrCode')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async checkInPlusOne(@Param('qrCode') qrCode: string) {
    return this.plusOneService.checkInPlusOne(qrCode);
  }

  @Get('check-in/plus-one/:qrCode/verify')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async verifyPlusOneQr(@Param('qrCode') qrCode: string) {
    return this.plusOneService.verifyPlusOneQr(qrCode);
  }
}
