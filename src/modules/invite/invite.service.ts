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

    // Generate HTML email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hello,</p>
    
    <p>You're invited to an exclusive event: <strong>${event.eventName}</strong></p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="margin-top: 0; color: #667eea;">Event Details</h2>
      <p><strong>Date:</strong> ${eventDate}</p>
      <p><strong>Time:</strong> ${event.eventStartTime} - ${event.eventEndTime}</p>
      <p><strong>Venue:</strong> ${event.venueName}</p>
      <p><strong>Address:</strong> ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}</p>
      <p><strong>Dress Code:</strong> ${event.dressCode}</p>
    </div>
    
    ${event.description ? `<p style="color: #666; font-style: italic;">${event.description}</p>` : ''}
    
    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <p style="margin: 0; font-size: 14px; color: #666;">This is a personal invitation. Please do not share this link.</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${rsvpLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: bold; font-size: 18px;">
        RSVP Now
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      This invitation expires on ${new Date(invite.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
    </p>
    
    <p style="color: #666; font-size: 14px;">
      If you have any questions, please contact us at events@levyeromedia.com
    </p>
    
    <p style="color: #666; font-size: 14px;">
      We look forward to seeing you!<br>
      <strong>LEM Ventures Team</strong>
    </p>
  </div>
</body>
</html>
    `.trim();

    // Generate plain text version
    const textContent = `
You're Invited!

Hello,

You're invited to an exclusive event: ${event.eventName}

EVENT DETAILS
Date: ${eventDate}
Time: ${event.eventStartTime} - ${event.eventEndTime}
Venue: ${event.venueName}
Address: ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}
Dress Code: ${event.dressCode}

${event.description || ''}

This is a personal invitation. Please do not share this link.

RSVP NOW: ${rsvpLink}

This invitation expires on ${new Date(invite.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.

If you have any questions, please contact us at events@levyeromedia.com

We look forward to seeing you!
LEM Ventures Team
    `.trim();

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
