import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { Invite } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface CreateInviteDto {
  email: string;
  eventId: string;
  sendEmail?: boolean;
}

export interface BulkCreateInvitesDto {
  eventId: string;
  invites: Array<{
    email: string;
  }>;
  sendEmails?: boolean;
}

@Injectable()
export class InviteService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async generateInvite(
    email: string,
    eventId: string
  ): Promise<Invite> {
    // Generate secure token
    const token = randomUUID();
    
    // Set expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    return this.prisma.invite.create({
      data: {
        email,
        token,
        expiresAt,
        eventId,
      },
    });
  }

  async validateToken(token: string): Promise<Invite> {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      include: {
        event: true,
      },
    });

    if (!invite) {
      throw new NotFoundException('Invalid invite token');
    }

    if (invite.isUsed) {
      throw new BadRequestException('Invite token has already been used');
    }

    if (new Date() > invite.expiresAt) {
      throw new BadRequestException('Invite token has expired');
    }

    return invite;
  }

  async markTokenAsUsed(token: string): Promise<void> {
    await this.prisma.invite.update({
      where: { token },
      data: { isUsed: true },
    });
  }

  async checkTokenExpiry(token: string): Promise<boolean> {
    const invite = await this.prisma.invite.findUnique({
      where: { token },
      select: { expiresAt: true },
    });

    if (!invite) {
      return false;
    }

    return new Date() <= invite.expiresAt;
  }

  async findByToken(token: string): Promise<Invite | null> {
    return this.prisma.invite.findUnique({
      where: { token },
      include: {
        event: true,
      },
    });
  }

  /**
   * Create a single invite and optionally send invitation email
   */
  async createInvite(data: CreateInviteDto): Promise<Invite> {
    const { email, eventId, sendEmail = true } = data;

    // Check if event exists
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check if invite already exists for this email and event
    const existingInvite = await this.prisma.invite.findFirst({
      where: {
        email,
        eventId,
      },
    });

    if (existingInvite) {
      throw new BadRequestException('Invite already exists for this email');
    }

    // Generate invite
    const invite = await this.generateInvite(email, eventId);

    // Send invitation email if requested
    if (sendEmail) {
      try {
        await this.sendInvitationEmail(invite, event);
      } catch (error) {
        console.error('Failed to send invitation email:', error);
        // Don't fail the invite creation if email fails
      }
    }

    return invite;
  }

  /**
   * Create multiple invites at once
   */
  async bulkCreateInvites(data: BulkCreateInvitesDto): Promise<{
    created: number;
    failed: number;
    invites: Invite[];
  }> {
    const { eventId, invites, sendEmails = true } = data;

    // Check if event exists
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const results = {
      created: 0,
      failed: 0,
      invites: [] as Invite[],
    };

    for (const inviteData of invites) {
      try {
        const invite = await this.createInvite({
          email: inviteData.email,
          eventId,
          sendEmail: sendEmails,
        });
        results.invites.push(invite);
        results.created++;
      } catch (error) {
        console.error(`Failed to create invite for ${inviteData.email}:`, error);
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Send invitation email with RSVP link
   */
  private async sendInvitationEmail(invite: Invite, event: any): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const rsvpLink = `${frontendUrl}/?token=${invite.token}`;

    const eventDate = new Date(event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Format times to 12-hour format
    const formatTimeTo12Hour = (time: string): string => {
      if (!time) return time;
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const startTime = formatTimeTo12Hour(event.eventStartTime);
    const endTime = formatTimeTo12Hour(event.eventEndTime);

    // Hero and logo image URLs
    const heroImageUrl = 'https://i.ibb.co/XZJHXcCp/mask-group.png';
    const logoUrl = 'https://i.ibb.co/HpRR250c/lemm.png';

    // Generate HTML email with responsive design matching confirmation emails
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>body,table,td{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse!important}img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none}@media(min-width:600px){.r{display:table-row!important}.c{display:table-cell!important;vertical-align:middle!important}.l{width:50%!important}.g{width:50%!important}.d-show{display:block!important}.m-show{display:none!important}.d-push{padding-top:60px!important}}@media(max-width:599px){.m-show{display:block!important}.d-show{display:none!important}.m-stack{display:block!important;width:100%!important}.m-title{font-size:20px!important;letter-spacing:1px!important;white-space:nowrap!important}}</style></head><body style="margin:0;padding:0;font-family:Inter,sans-serif;background:#000"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:1200px;margin:0 auto;background:#000"><tr class="r"><td class="c l m-stack" style="padding:0;background:#000;vertical-align:middle"><div style="padding:30px 40px;background:#000;text-align:center"><div style="margin:0 0 30px;overflow:hidden;border-radius:12px;box-shadow:0 8px 24px rgba(255,140,0,.3);border:1px solid rgba(255,140,0,.4)"><img src="${heroImageUrl}" alt="Event" style="width:100%;height:auto;display:block;max-height:280px;object-fit:cover"></div><p style="color:#ccc;font-size:15px;margin:0 0 5px;font-weight:300;line-height:1.6">Greetings!</p><p style="color:#ccc;font-size:15px;margin:0 0 20px;font-weight:300;line-height:1.6">You're invited to an exclusive event</p><div class="m-show" style="display:none;margin:0 0 20px"><img src="${logoUrl}" alt="Logo" style="max-width:200px;width:70%;height:auto;margin:0 auto;display:block"></div><h1 class="m-title" style="color:#fff;font-size:34px;margin:0 0 15px;font-weight:700;letter-spacing:2px;line-height:1.2">${event.eventName.toUpperCase()}</h1><div style="width:80px;height:2px;background:#ff8c00;margin:0 auto 20px"></div>${event.description ? `<p style="color:#ccc;font-size:15px;line-height:1.6;margin:0 0 30px;font-weight:300">${event.description}</p>` : ''}<a href="${rsvpLink}" class="d-show" style="display:inline-block;background:#666;color:#fff;text-decoration:none;padding:14px 50px;border-radius:30px;font-size:14px;font-weight:600;letter-spacing:1px">RSVP NOW</a></div></td><td class="c g m-stack" style="padding:0;background:#000;vertical-align:middle"><div style="padding:40px 35px 25px;text-align:center" class="d-show"><img src="${logoUrl}" alt="Logo" style="max-width:280px;width:100%;height:auto;margin:0 auto"></div><div style="padding:0 35px 35px" class="d-push"><div style="border:2px solid #ff8c00;border-radius:12px;padding:30px 25px;background:rgba(0,0,0,.5)"><h2 style="color:#fff;font-size:24px;text-align:center;margin:0 0 12px;font-weight:600">Event Details</h2><div style="width:60px;height:2px;background:#ff8c00;margin:0 auto 25px"></div><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/qYVNy2F9/calendar.png" alt="" style="width:16px;height:16px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">${eventDate}</strong></td></tr><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/vxNCHPp7/clock.png" alt="" style="width:16px;height:16px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">${startTime} - ${endTime}</strong></td></tr><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/S4q77qPS/location.png" alt="" style="width:16px;height:16px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">${event.venueName},</strong><br><span style="color:#ccc;font-size:13px;font-weight:300">${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}</span></td></tr><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/RkXwWsHv/bow.png" alt="" style="width:16px;height:16px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">Dress ${event.dressCode}</strong></td></tr></table></div><div class="m-show" style="display:none;margin:25px 0 0;text-align:center"><a href="${rsvpLink}" style="display:inline-block;background:#ff8c00;color:#fff;text-decoration:none;padding:12px 40px;border-radius:25px;font-size:14px;font-weight:600;letter-spacing:1px;border:2px solid #ff8c00">RSVP NOW</a></div></div></td></tr><tr><td colspan="2" style="background:#ff8c00;padding:18px 40px;text-align:center"><p style="margin:0 0 5px;color:#000;font-size:14px;font-weight:600">Personal Invitation</p><p style="margin:0;color:#000;font-size:12px;font-weight:400">This is your unique invitation link. Please do not share it.</p></td></tr><tr><td colspan="2" style="background:#000;padding:20px 40px;text-align:center;border-top:1px solid #333"><p style="color:#999;font-size:13px;margin:0 0 10px;font-weight:300">Questions? Contact us at <a href="mailto:contact@levyeromedia.com" style="color:#ff8c00;text-decoration:none">contact@levyeromedia.com</a></p><div class="m-show" style="display:none;margin:15px 0 0"><img src="${logoUrl}" alt="Logo" style="max-width:150px;width:50%;height:auto;margin:0 auto;display:block;opacity:.6"></div></td></tr></table></body></html>`.trim();

    // Generate plain text version
    const textContent = `Greetings! You're invited to an exclusive event

${event.eventName.toUpperCase()}

EVENT: ${eventDate}, ${startTime}-${endTime}
VENUE: ${event.venueName}, ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}
DRESS: ${event.dressCode}

PERSONAL INVITATION: This is your unique invitation link. Please do not share it.

RSVP: ${rsvpLink}

Questions? contact@levyeromedia.com`.trim();

    // Send email using EmailService
    await this.emailService.sendInvitationEmail(
      invite.email,
      `You're Invited: ${event.eventName}`,
      htmlContent,
      textContent
    );
  }

  /**
   * Get all invites for an event
   */
  async getEventInvites(eventId: string): Promise<Invite[]> {
    return this.prisma.invite.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Resend invitation email
   */
  async resendInvitation(inviteId: string): Promise<void> {
    const invite = await this.prisma.invite.findUnique({
      where: { id: inviteId },
      include: { event: true },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.isUsed) {
      throw new BadRequestException('Cannot resend used invite');
    }

    await this.sendInvitationEmail(invite, invite.event);
  }
}
