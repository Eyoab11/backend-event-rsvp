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

    // Generate HTML email
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited!</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #ffffff; max-width: 600px; margin: 0 auto; padding: 0; background-color: #000000;">
  
  <!-- Hero Banner -->
  <div style="position: relative; height: 200px; overflow: hidden; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);">
    <img src="https://t4.ftcdn.net/jpg/05/64/91/35/240_F_564913571_s7Dbf5hVB1T1GTeG2GFDEqNOgmvPz87k.jpg" alt="Event Banner" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;" />
    <div style="position: absolute; inset: 0; background: linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(217,119,6,0.3) 100%);"></div>
    
    <div style="position: relative; z-index: 1; text-align: center; padding: 60px 20px 20px;">
      <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #ffffff; margin: 0 0 8px 0; font-size: 42px; font-weight: 900; letter-spacing: 1px; text-shadow: 2px 2px 8px rgba(0,0,0,0.5);">You're Invited!</h1>
      <p style="color: #fbbf24; font-size: 16px; margin: 0; font-weight: 500; text-shadow: 1px 1px 3px rgba(0,0,0,0.5);">🥂 Join us for an exclusive event 🍷</p>
    </div>
  </div>
  
  <!-- Main Content -->
  <div style="background: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%); padding: 25px 20px;">
    <p style="font-size: 18px; margin: 0 0 15px 0; color: #ffffff; font-weight: 500;">Hello,</p>
    
    <p style="color: #e5e5e5; margin: 0 0 20px 0; font-size: 15px;">You're invited to an exclusive event: <strong style="color: #f59e0b;">${event.eventName}</strong></p>
    
    <!-- Event Details Card -->
    <div style="background: linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.1) 100%); padding: 20px; border-radius: 12px; margin: 0 0 20px 0; border: 1px solid rgba(245,158,11,0.3);">
      <h2 style="font-family: 'Playfair Display', Georgia, serif; margin: 0 0 15px 0; color: #f59e0b; font-size: 26px; font-weight: 700; text-align: center; letter-spacing: 0.5px;">🎊 Event Details</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #fbbf24; font-weight: 600; font-size: 14px; width: 35%;">📅 Date:</td>
          <td style="padding: 8px 0; color: #e5e5e5; font-size: 14px;">${eventDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #fbbf24; font-weight: 600; font-size: 14px;">⏰ Time:</td>
          <td style="padding: 8px 0; color: #e5e5e5; font-size: 14px;">${startTime} - ${endTime}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #fbbf24; font-weight: 600; font-size: 14px;">📍 Venue:</td>
          <td style="padding: 8px 0; color: #e5e5e5; font-size: 14px;">${event.venueName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #fbbf24; font-weight: 600; font-size: 14px;">🗺️ Address:</td>
          <td style="padding: 8px 0; color: #e5e5e5; font-size: 14px;">${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #fbbf24; font-weight: 600; font-size: 14px;">👔 Dress Code:</td>
          <td style="padding: 8px 0; color: #e5e5e5; font-size: 14px;">${event.dressCode}</td>
        </tr>
      </table>
    </div>
    
    ${event.description ? `<p style="color: #e5e5e5; font-size: 14px; font-style: italic; margin: 0 0 20px 0; line-height: 1.6;">${event.description}</p>` : ''}
    
    <!-- Personal Invitation Notice -->
    <div style="background: linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.15) 100%); padding: 15px; border-radius: 8px; margin: 0 0 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #ffffff; font-size: 14px; line-height: 1.6;"><strong style="color: #fbbf24;">🔒 Personal Invitation:</strong> This is your unique invitation link. Please do not share it.</p>
    </div>
    
    <!-- RSVP Button -->
    <div style="text-align: center; margin: 25px 0;">
      <a href="${rsvpLink}" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 16px 48px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: 600; font-size: 18px; box-shadow: 0 4px 15px rgba(245,158,11,0.4); transition: all 0.3s;">
        RSVP Now
      </a>
    </div>
    
    <p style="color: #999999; font-size: 13px; margin: 20px 0 0 0; text-align: center;">
      This invitation expires on ${new Date(invite.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
    </p>
    
    <!-- Divider -->
    <div style="margin: 20px 0; text-align: center;">
      <span style="font-size: 24px;">🥂 ✨ 🍷</span>
    </div>
    
    <p style="color: #999999; font-size: 13px; margin: 15px 0 0 0; line-height: 1.5;">
      Questions? Contact us at <a href="mailto:contact@levyeromedia.com" style="color: #f59e0b; text-decoration: none;">contact@levyeromedia.com</a>
    </p>
    
    <p style="color: #999999; font-size: 13px; margin: 10px 0 0 0;">
      We look forward to seeing you!<br>
      <strong style="color: #f59e0b;">LEM Team</strong>
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
Time: ${startTime} - ${endTime}
Venue: ${event.venueName}
Address: ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}
Dress Code: ${event.dressCode}

${event.description || ''}

PERSONAL INVITATION: This is your unique invitation link. Please do not share it.

RSVP NOW: ${rsvpLink}

This invitation expires on ${new Date(invite.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.

If you have any questions, please contact us at contact@levyeromedia.com

We look forward to seeing you!
LEM Team
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
