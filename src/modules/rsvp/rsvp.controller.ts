import { Controller, Post, Body, Get, Param, Delete, UseGuards } from '@nestjs/common';
import { RsvpService, RegistrationResponseDto } from './rsvp.service';
import { CreateRsvpDto } from './dto/create-rsvp.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller('rsvp')
@UseGuards(ThrottlerGuard)
export class RsvpController {
  constructor(private readonly rsvpService: RsvpService) {}

  @Post('submit')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async submitRsvp(@Body() createRsvpDto: CreateRsvpDto): Promise<RegistrationResponseDto> {
    return this.rsvpService.submitRsvp(createRsvpDto);
  }

  @Get('success/:attendeeId')
  async getRegistrationDetails(@Param('attendeeId') attendeeId: string): Promise<RegistrationResponseDto> {
    return this.rsvpService.getRegistrationDetails(attendeeId);
  }

  @Delete('cancel/:attendeeId')
  async cancelRsvp(@Param('attendeeId') attendeeId: string): Promise<{ message: string }> {
    await this.rsvpService.cancelRsvp(attendeeId);
    return { message: 'RSVP cancelled successfully' };
  }
}
