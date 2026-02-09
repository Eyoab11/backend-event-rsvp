import { Controller, Get, Param, Post, Body, BadRequestException } from '@nestjs/common';
import { InviteService } from './invite.service';
import type { CreateInviteDto, BulkCreateInvitesDto } from './invite.service';
import { Invite } from '@prisma/client';

@Controller('invite')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Get('validate/:token')
  async validateToken(@Param('token') token: string): Promise<{
    valid: boolean;
    invite?: Invite;
    message?: string;
  }> {
    try {
      const invite = await this.inviteService.validateToken(token);
      return {
        valid: true,
        invite,
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message,
      };
    }
  }

  @Post('create')
  async createInvite(@Body() createInviteDto: CreateInviteDto): Promise<Invite> {
    if (!createInviteDto.email || !createInviteDto.eventId) {
      throw new BadRequestException('Email and eventId are required');
    }

    return this.inviteService.createInvite(createInviteDto);
  }

  @Post('bulk-create')
  async bulkCreateInvites(@Body() bulkCreateDto: BulkCreateInvitesDto): Promise<{
    created: number;
    failed: number;
    invites: Invite[];
  }> {
    if (!bulkCreateDto.eventId || !bulkCreateDto.invites || bulkCreateDto.invites.length === 0) {
      throw new BadRequestException('EventId and invites array are required');
    }

    return this.inviteService.bulkCreateInvites(bulkCreateDto);
  }

  @Get('event/:eventId')
  async getEventInvites(@Param('eventId') eventId: string): Promise<Invite[]> {
    return this.inviteService.getEventInvites(eventId);
  }

  @Post('resend/:inviteId')
  async resendInvitation(@Param('inviteId') inviteId: string): Promise<{ message: string }> {
    await this.inviteService.resendInvitation(inviteId);
    return { message: 'Invitation email resent successfully' };
  }

  @Get(':token')
  async getInviteByToken(@Param('token') token: string): Promise<Invite | null> {
    return this.inviteService.findByToken(token);
  }
}
