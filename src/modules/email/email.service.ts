import { Injectable, Logger } from '@nestjs/common';
import { Event, Attendee, PlusOne } from '@prisma/client';
import { Resend } from 'resend';

export interface ConfirmationEmailData {
  event: Event;
  attendee: Attendee;
  plusOne?: PlusOne | null;
  qrCodeImage?: string;
  calendarFile?: string;
}

export interface PlusOneConfirmationEmailData {
  event: Event;
  plusOne: PlusOne & { qrCode: string; registrationId: string };
  primaryAttendeeName: string;
  qrCodeImage?: string;
  calendarFile?: string;
}

export interface WaitlistEmailData {
  event: Event;
  attendee: Attendee;
  plusOne?: PlusOne | null;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | undefined;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;
  private readonly heroImageUrl: string;
  private readonly logoUrl: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;
    const frontendUrl = process.env.FRONTEND_URL;

    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set. Email functionality will be disabled.');
      // Set dummy values to satisfy TypeScript, but service won't be functional
      this.fromEmail = '';
      this.frontendUrl = '';
      this.heroImageUrl = '';
      this.logoUrl = '';
      return;
    }

    if (!fromEmail) {
      this.logger.error('FROM_EMAIL environment variable is required but not set.');
      throw new Error('FROM_EMAIL environment variable is required');
    }

    if (!frontendUrl) {
      this.logger.error('FRONTEND_URL environment variable is required but not set.');
      throw new Error('FRONTEND_URL environment variable is required');
    }

    this.fromEmail = fromEmail;
    this.frontendUrl = frontendUrl;
    
    // Direct image URLs from ImgBB - exact URLs that work in browser
    this.heroImageUrl = 'https://i.ibb.co/XZJHXcCp/mask-group.png';
    this.logoUrl = 'https://i.ibb.co/HpRR250c/lemm.png';
    
    this.resend = new Resend(apiKey);
    this.logger.log('Email service initialized with Resend API');
    this.logger.log('Email images loaded successfully');
  }

  /**
   * Convert 24-hour time format to 12-hour format with AM/PM
   * Example: "19:00" -> "7:00 PM", "07:00" -> "7:00 AM"
   */
  private formatTimeTo12Hour(time: string): string {
    if (!time) return time;
    
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  /**
   * Send email using Resend API with attachments support
   */
  private async sendEmail(
    to: string, 
    subject: string, 
    htmlContent: string, 
    textContent: string, 
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Email service not configured. Skipping email.');
      return;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject,
        html: htmlContent,
        text: textContent,
        attachments: attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
        })),
      });

      if (error) {
        throw new Error(`Resend API error: ${error.message}`);
      }

      this.logger.log(`Email sent successfully to ${to}, messageId: ${data?.id}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send confirmation email to attendee
   */
  async sendConfirmationEmail(data: ConfirmationEmailData): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Email service not configured. Skipping confirmation email.');
      return;
    }

    const { event, attendee, plusOne, qrCodeImage, calendarFile } = data;

    try {
      const htmlContent = this.generateConfirmationEmailHtml(data);
      const textContent = this.generateConfirmationEmailText(data);

      const attachments: Array<{ filename: string; content: Buffer }> = [];
      
      // Add calendar attachment if provided
      if (calendarFile) {
        attachments.push({
          filename: `${event.eventName.toLowerCase().replace(/\s+/g, '-')}.ics`,
          content: Buffer.from(calendarFile),
        });
      }

      // Add QR code as attachment if provided
      if (qrCodeImage) {
        // Extract base64 content from data URL (remove "data:image/png;base64," prefix)
        const base64Content = qrCodeImage.replace(/^data:image\/\w+;base64,/, '');
        attachments.push({
          filename: 'qr-code.png',
          content: Buffer.from(base64Content, 'base64'),
        });
      }

      await this.sendEmail(
        attendee.email,
        `Confirmed: ${event.eventName}`,
        htmlContent,
        textContent,
        attachments.length > 0 ? attachments : undefined
      );

      this.logger.log(`Confirmation email sent to ${attendee.email}`);
    } catch (error) {
      this.logger.error(`Failed to send confirmation email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send waitlist email to attendee
   */
  async sendWaitlistEmail(data: WaitlistEmailData): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Email service not configured. Skipping waitlist email.');
      return;
    }

    const { event, attendee, plusOne } = data;

    try {
      const htmlContent = this.generateWaitlistEmailHtml(data);
      const textContent = this.generateWaitlistEmailText(data);

      await this.sendEmail(
        attendee.email,
        `Waitlisted: ${event.eventName}`,
        htmlContent,
        textContent
      );

      this.logger.log(`Waitlist email sent to ${attendee.email}`);
    } catch (error) {
      this.logger.error(`Failed to send waitlist email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send confirmation email to plus-one with their own QR code
   */
  async sendPlusOneConfirmationEmail(data: PlusOneConfirmationEmailData): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Email service not configured. Skipping plus-one confirmation email.');
      return;
    }

    const { event, plusOne, primaryAttendeeName, qrCodeImage, calendarFile } = data;

    try {
      const htmlContent = this.generatePlusOneConfirmationEmailHtml(data);
      const textContent = this.generatePlusOneConfirmationEmailText(data);

      const attachments: Array<{ filename: string; content: Buffer }> = [];
      
      // Add calendar attachment if provided
      if (calendarFile) {
        attachments.push({
          filename: `${event.eventName.toLowerCase().replace(/\s+/g, '-')}.ics`,
          content: Buffer.from(calendarFile),
        });
      }

      // Add QR code as attachment if provided
      if (qrCodeImage) {
        // Extract base64 content from data URL (remove "data:image/png;base64," prefix)
        const base64Content = qrCodeImage.replace(/^data:image\/\w+;base64,/, '');
        attachments.push({
          filename: 'qr-code-plusone.png',
          content: Buffer.from(base64Content, 'base64'),
        });
      }

      await this.sendEmail(
        plusOne.email,
        `Confirmed: ${event.eventName}`,
        htmlContent,
        textContent,
        attachments.length > 0 ? attachments : undefined
      );

      this.logger.log(`Plus-one confirmation email sent to ${plusOne.email}`);
    } catch (error) {
      this.logger.error(`Failed to send plus-one confirmation email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send invitation email
   */
  async sendInvitationEmail(to: string, subject: string, htmlContent: string, textContent: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Email service not configured. Skipping invitation email.');
      return;
    }

    try {
      await this.sendEmail(to, subject, htmlContent, textContent);
      this.logger.log(`Invitation email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send invitation email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generate HTML content for confirmation email
   */
  private generateConfirmationEmailHtml(data: ConfirmationEmailData): string {
    const { event, attendee, plusOne } = data;
    const eventDate = new Date(event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const startTime = this.formatTimeTo12Hour(event.eventStartTime);
    const endTime = this.formatTimeTo12Hour(event.eventEndTime);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>body,table,td{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse!important}img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none}@media(min-width:600px){.r{display:table-row!important}.c{display:table-cell!important;vertical-align:middle!important}.l{width:50%!important}.g{width:50%!important}.d-show{display:block!important}.m-show{display:none!important}.d-push{padding-top:40px!important}.qr-banner{background:#000!important;padding:30px 40px!important}.qr-title{color:#fff!important;font-size:18px!important}.qr-text{color:#ccc!important;font-size:15px!important}}@media(max-width:599px){.m-show{display:block!important}.d-show{display:none!important}.m-stack{display:block!important;width:100%!important}.m-title{font-size:20px!important;letter-spacing:1px!important;white-space:nowrap!important}.qr-banner{background:#ff8c00!important;padding:18px 40px!important}.qr-title{color:#000!important;font-size:14px!important}.qr-text{color:#000!important;font-size:12px!important}}</style></head><body style="margin:0;padding:0;font-family:Inter,sans-serif;background:#000"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:1200px;margin:0 auto;background:#000"><tr class="r"><td class="c l m-stack" style="padding:0;background:#000;vertical-align:middle"><div style="padding:30px 40px;background:#000;text-align:center"><div style="margin:0 0 30px;overflow:hidden;border-radius:12px;box-shadow:0 8px 24px rgba(255,140,0,.3);border:1px solid rgba(255,140,0,.4)"><img src="${this.heroImageUrl}" alt="Event" style="width:100%;height:auto;display:block;max-height:280px;object-fit:cover"></div><p style="color:#ff8c00;font-size:18px;margin:0 0 5px;font-weight:600;line-height:1.6">You're Confirmed!</p><p style="color:#ccc;font-size:15px;margin:0 0 20px;font-weight:300;line-height:1.6">Hi ${attendee.name}, we're excited to see you at</p><div class="m-show" style="display:none;margin:0 0 20px"><img src="${this.logoUrl}" alt="Logo" style="max-width:200px;width:70%;height:auto;margin:0 auto;display:block"></div><h1 class="m-title" style="color:#fff;font-size:34px;margin:0 0 15px;font-weight:700;letter-spacing:2px;line-height:1.2">${event.eventName.toUpperCase()}</h1><div style="width:80px;height:2px;background:#ff8c00;margin:0 auto 20px"></div><div style="padding:20px;margin:0 0 20px"><h3 style="color:#fff;font-size:18px;text-align:center;margin:0 0 10px;font-weight:600">Your Registration</h3><div style="width:50px;height:2px;background:#ff8c00;margin:0 auto 15px"></div><p style="color:#ccc;font-size:14px;margin:5px 0;text-align:center"><strong style="color:#ff8c00">ID:</strong> ${attendee.registrationId}</p><p style="color:#ccc;font-size:14px;margin:5px 0;text-align:center"><strong style="color:#ff8c00">Name:</strong> ${attendee.name}</p><p style="color:#ccc;font-size:14px;margin:5px 0;text-align:center"><strong style="color:#ff8c00">Company:</strong> ${attendee.company}</p>${plusOne ? `<p style="color:#ccc;font-size:14px;margin:5px 0;text-align:center"><strong style="color:#ff8c00">Plus One:</strong> ${plusOne.name}</p>` : ''}</div></div></td><td class="c g m-stack" style="padding:0;background:#000;vertical-align:middle"><div style="padding:40px 35px 25px;text-align:center" class="d-show"><img src="${this.logoUrl}" alt="Logo" style="max-width:280px;width:100%;height:auto;margin:0 auto"></div><div style="padding:0 35px 35px" class="d-push"><div style="border:2px solid #ff8c00;border-radius:12px;padding:30px 25px;background:rgba(0,0,0,.5)"><h2 style="color:#fff;font-size:24px;text-align:center;margin:0 0 12px;font-weight:600">Event Details</h2><div style="width:60px;height:2px;background:#ff8c00;margin:0 auto 25px"></div><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/qYVNy2F9/calendar.png" alt="" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">${eventDate}</strong></td></tr><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/vxNCHPp7/clock.png" alt="" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">${startTime} - ${endTime}</strong></td></tr><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/S4q77qPS/location.png" alt="" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">${event.venueName},</strong><br><span style="color:#ccc;font-size:13px;font-weight:300">${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}</span></td></tr><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/RkXwWsHv/bow.png" alt="" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">Dress ${event.dressCode}</strong></td></tr></table></div></div></td></tr><tr><td colspan="2" class="qr-banner" style="background:#ff8c00;padding:18px 40px;text-align:center"><p class="qr-title" style="margin:0 0 5px;color:#000;font-size:14px;font-weight:600">Save Your QR Code</p><p class="qr-text" style="margin:0;color:#000;font-size:12px;font-weight:400">Your QR code is attached. Save it or screenshot for check-in at the event.</p></td></tr><tr><td colspan="2" style="background:#000;padding:20px 40px;text-align:center;border-top:1px solid #333"><p style="color:#999;font-size:13px;margin:0 0 10px;font-weight:300">Questions? Contact us at <a href="mailto:contact@levyeromedia.com" style="color:#ff8c00;text-decoration:none">contact@levyeromedia.com</a></p><div class="m-show" style="display:none;margin:15px 0 0"><img src="${this.logoUrl}" alt="Logo" style="max-width:150px;width:50%;height:auto;margin:0 auto;display:block;opacity:.6"></div></td></tr></table></body></html>`.trim();
  }

  /**
   * Generate plain text content for confirmation email
   */
  private generateConfirmationEmailText(data: ConfirmationEmailData): string {
    const { event, attendee, plusOne } = data;
    const eventDate = new Date(event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const startTime = this.formatTimeTo12Hour(event.eventStartTime);
    const endTime = this.formatTimeTo12Hour(event.eventEndTime);

    return `You're Confirmed!

Hi ${attendee.name}, your registration for ${event.eventName} is confirmed!

EVENT: ${eventDate}, ${startTime}-${endTime}
VENUE: ${event.venueName}, ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}
DRESS: ${event.dressCode}

REGISTRATION: ${attendee.registrationId} | ${attendee.name} | ${attendee.company}${plusOne ? ` | +1: ${plusOne.name}` : ''}

Your QR code is attached. Save it for check-in.${plusOne ? ' Your plus-one will receive their own QR code.' : ''}

Questions? contact@levyeromedia.com`.trim();
  }

  /**
   * Generate HTML content for waitlist email
   */
  private generateWaitlistEmailHtml(data: WaitlistEmailData): string {
    const { event, attendee, plusOne } = data;
    const eventDate = new Date(event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const startTime = this.formatTimeTo12Hour(event.eventStartTime);
    const endTime = this.formatTimeTo12Hour(event.eventEndTime);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Waitlist Confirmation</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #ffffff; max-width: 600px; margin: 0 auto; padding: 0; background-color: #000000;">
  
  <!-- Hero Banner -->
  <div style="position: relative; height: 200px; overflow: hidden; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);">
    <img src="https://t4.ftcdn.net/jpg/05/64/91/35/240_F_564913571_s7Dbf5hVB1T1GTeG2GFDEqNOgmvPz87k.jpg" alt="Event Banner" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;" />
    <div style="position: absolute; inset: 0; background: linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(217,119,6,0.3) 100%);"></div>
    
    <div style="position: relative; z-index: 1; text-align: center; padding: 60px 20px 20px;">
      <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #ffffff; margin: 0 0 8px 0; font-size: 42px; font-weight: 900; letter-spacing: 1px; text-shadow: 2px 2px 8px rgba(0,0,0,0.5);">You're on the Waitlist</h1>
      <p style="color: #fbbf24; font-size: 16px; margin: 0; font-weight: 500; text-shadow: 1px 1px 3px rgba(0,0,0,0.5);">⏳ We'll notify you if a spot opens up</p>
    </div>
  </div>
  
  <!-- Main Content -->
  <div style="background: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%); padding: 25px 20px;">
    <p style="font-size: 18px; margin: 0 0 15px 0; color: #ffffff; font-weight: 500;">Hi ${attendee.name},</p>
    
    <p style="color: #e5e5e5; margin: 0 0 15px 0; font-size: 15px;">Thank you for your interest in <strong style="color: #f59e0b;">${event.eventName}</strong>!</p>
    
    <p style="color: #e5e5e5; margin: 0 0 20px 0; font-size: 15px;">The event is currently at capacity, but we've added you to our waitlist. We'll notify you immediately if a spot becomes available.</p>
    
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
      </table>
    </div>
    
    <!-- Registration Card -->
    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin: 0 0 20px 0; border: 1px solid rgba(255,255,255,0.1);">
      <h3 style="font-family: 'Playfair Display', Georgia, serif; margin: 0 0 12px 0; color: #f59e0b; font-size: 22px; font-weight: 700;">Your Registration</h3>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 14px;"><strong style="color: #fbbf24;">ID:</strong> ${attendee.registrationId}</p>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 14px;"><strong style="color: #fbbf24;">Name:</strong> ${attendee.name}</p>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 14px;"><strong style="color: #fbbf24;">Company:</strong> ${attendee.company}</p>
      ${plusOne ? `<p style="margin: 8px 0; color: #e5e5e5; font-size: 14px;"><strong style="color: #fbbf24;">Plus One:</strong> ${plusOne.name} (${plusOne.company})</p>` : ''}
      <p style="margin: 8px 0; color: #fbbf24; font-size: 14px; font-weight: 600;">Status: Waitlisted</p>
    </div>
    
    <!-- Important Notice -->
    <div style="background: linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.15) 100%); padding: 15px; border-radius: 8px; margin: 0 0 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #ffffff; font-size: 14px; line-height: 1.6;"><strong style="color: #fbbf24;">📧 We'll notify you:</strong> Keep an eye on your inbox! We'll email you immediately if a spot becomes available.</p>
    </div>
    
    <!-- Divider -->
    <div style="margin: 20px 0; text-align: center;">
      <span style="font-size: 24px;">🥂 ✨ 🍷</span>
    </div>
    
    <p style="color: #999999; font-size: 13px; margin: 15px 0 0 0; line-height: 1.5;">
      Questions? Contact us at <a href="mailto:contact@levyeromedia.com" style="color: #f59e0b; text-decoration: none;">contact@levyeromedia.com</a>
    </p>
    
    <p style="color: #999999; font-size: 13px; margin: 10px 0 0 0;">
      Thank you for your understanding!<br>
      <strong style="color: #f59e0b;">LEM Team</strong>
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text content for waitlist email
   */
  private generateWaitlistEmailText(data: WaitlistEmailData): string {
    const { event, attendee, plusOne } = data;
    const eventDate = new Date(event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const startTime = this.formatTimeTo12Hour(event.eventStartTime);
    const endTime = this.formatTimeTo12Hour(event.eventEndTime);

    return `
You're on the Waitlist

Hi ${attendee.name},

Thank you for your interest in ${event.eventName}!

The event is currently at capacity, but we've added you to our waitlist. We'll notify you immediately if a spot becomes available.

EVENT DETAILS
Date: ${eventDate}
Time: ${startTime} - ${endTime}
Venue: ${event.venueName}
Address: ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}

YOUR REGISTRATION
Registration ID: ${attendee.registrationId}
Name: ${attendee.name}
Company: ${attendee.company}
${plusOne ? `Plus One: ${plusOne.name} (${plusOne.company})` : ''}
Status: Waitlisted

We'll send you an email if a spot opens up. Keep an eye on your inbox!

If you have any questions, please contact us at contact@levyeromedia.com

Thank you for your understanding!
LEM Team
    `.trim();
  }

  /**
   * Generate HTML content for plus-one confirmation email
   */
  private generatePlusOneConfirmationEmailHtml(data: PlusOneConfirmationEmailData): string {
    const { event, plusOne, primaryAttendeeName } = data;
    const eventDate = new Date(event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const startTime = this.formatTimeTo12Hour(event.eventStartTime);
    const endTime = this.formatTimeTo12Hour(event.eventEndTime);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>body,table,td{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse!important}img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none}@media(min-width:600px){.r{display:table-row!important}.c{display:table-cell!important;vertical-align:middle!important}.l{width:50%!important}.g{width:50%!important}.d-show{display:block!important}.m-show{display:none!important}.d-push{padding-top:40px!important}.qr-banner{background:#000!important;padding:30px 40px!important}.qr-title{color:#fff!important;font-size:18px!important}.qr-text{color:#ccc!important;font-size:15px!important}}@media(max-width:599px){.m-show{display:block!important}.d-show{display:none!important}.m-stack{display:block!important;width:100%!important}.m-title{font-size:20px!important;letter-spacing:1px!important;white-space:nowrap!important}.qr-banner{background:#ff8c00!important;padding:18px 40px!important}.qr-title{color:#000!important;font-size:14px!important}.qr-text{color:#000!important;font-size:12px!important}}</style></head><body style="margin:0;padding:0;font-family:Inter,sans-serif;background:#000"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:1200px;margin:0 auto;background:#000"><tr class="r"><td class="c l m-stack" style="padding:0;background:#000;vertical-align:middle"><div style="padding:30px 40px;background:#000;text-align:center"><div style="margin:0 0 30px;overflow:hidden;border-radius:12px;box-shadow:0 8px 24px rgba(255,140,0,.3);border:1px solid rgba(255,140,0,.4)"><img src="${this.heroImageUrl}" alt="Event" style="width:100%;height:auto;display:block;max-height:280px;object-fit:cover"></div><p style="color:#ff8c00;font-size:18px;margin:0 0 5px;font-weight:600;line-height:1.6">You're Confirmed!</p><p style="color:#ccc;font-size:15px;margin:0 0 20px;font-weight:300;line-height:1.6">Hi ${plusOne.name}, you're attending as a guest of ${primaryAttendeeName}</p><div class="m-show" style="display:none;margin:0 0 20px"><img src="${this.logoUrl}" alt="Logo" style="max-width:200px;width:70%;height:auto;margin:0 auto;display:block"></div><h1 class="m-title" style="color:#fff;font-size:34px;margin:0 0 15px;font-weight:700;letter-spacing:2px;line-height:1.2">${event.eventName.toUpperCase()}</h1><div style="width:80px;height:2px;background:#ff8c00;margin:0 auto 20px"></div><div style="padding:20px;margin:0 0 20px"><h3 style="color:#fff;font-size:18px;text-align:center;margin:0 0 10px;font-weight:600">Your Registration</h3><div style="width:50px;height:2px;background:#ff8c00;margin:0 auto 15px"></div><p style="color:#ccc;font-size:14px;margin:5px 0;text-align:center"><strong style="color:#ff8c00">ID:</strong> ${plusOne.registrationId}</p><p style="color:#ccc;font-size:14px;margin:5px 0;text-align:center"><strong style="color:#ff8c00">Name:</strong> ${plusOne.name}</p><p style="color:#ccc;font-size:14px;margin:5px 0;text-align:center"><strong style="color:#ff8c00">Company:</strong> ${plusOne.company}</p><p style="color:#ccc;font-size:14px;margin:5px 0;text-align:center"><strong style="color:#ff8c00">Guest of:</strong> ${primaryAttendeeName}</p></div></div></td><td class="c g m-stack" style="padding:0;background:#000;vertical-align:middle"><div style="padding:40px 35px 25px;text-align:center" class="d-show"><img src="${this.logoUrl}" alt="Logo" style="max-width:280px;width:100%;height:auto;margin:0 auto"></div><div style="padding:0 35px 35px" class="d-push"><div style="border:2px solid #ff8c00;border-radius:12px;padding:30px 25px;background:rgba(0,0,0,.5)"><h2 style="color:#fff;font-size:24px;text-align:center;margin:0 0 12px;font-weight:600">Event Details</h2><div style="width:60px;height:2px;background:#ff8c00;margin:0 auto 25px"></div><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/qYVNy2F9/calendar.png" alt="" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">${eventDate}</strong></td></tr><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/vxNCHPp7/clock.png" alt="" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">${startTime} - ${endTime}</strong></td></tr><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/S4q77qPS/location.png" alt="" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">${event.venueName},</strong><br><span style="color:#ccc;font-size:13px;font-weight:300">${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}</span></td></tr><tr><td style="color:#fff;font-size:15px;padding:10px 0;text-align:center"><img src="https://i.ibb.co/RkXwWsHv/bow.png" alt="" style="width:20px;height:20px;vertical-align:middle;margin-right:8px"><strong style="vertical-align:middle;font-weight:500">Dress ${event.dressCode}</strong></td></tr></table></div></div></td></tr><tr><td colspan="2" class="qr-banner" style="background:#ff8c00;padding:18px 40px;text-align:center"><p class="qr-title" style="margin:0 0 5px;color:#000;font-size:14px;font-weight:600">Save Your QR Code</p><p class="qr-text" style="margin:0;color:#000;font-size:12px;font-weight:400">Your QR code is attached. Save it or screenshot for check-in at the event.</p></td></tr><tr><td colspan="2" style="background:#000;padding:20px 40px;text-align:center;border-top:1px solid #333"><p style="color:#999;font-size:13px;margin:0 0 10px;font-weight:300">Questions? Contact us at <a href="mailto:contact@levyeromedia.com" style="color:#ff8c00;text-decoration:none">contact@levyeromedia.com</a></p><div class="m-show" style="display:none;margin:15px 0 0"><img src="${this.logoUrl}" alt="Logo" style="max-width:150px;width:50%;height:auto;margin:0 auto;display:block;opacity:.6"></div></td></tr></table></body></html>`.trim();
  }

  /**
   * Generate plain text content for plus-one confirmation email
   */
  private generatePlusOneConfirmationEmailText(data: PlusOneConfirmationEmailData): string {
    const { event, plusOne, primaryAttendeeName } = data;
    const eventDate = new Date(event.eventDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const startTime = this.formatTimeTo12Hour(event.eventStartTime);
    const endTime = this.formatTimeTo12Hour(event.eventEndTime);

    return `You're Confirmed!

Hi ${plusOne.name}, your registration for ${event.eventName} is confirmed as a guest of ${primaryAttendeeName}!

EVENT: ${eventDate}, ${startTime}-${endTime}
VENUE: ${event.venueName}, ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}
DRESS: ${event.dressCode}

REGISTRATION: ${plusOne.registrationId} | ${plusOne.name} | ${plusOne.company} | Guest of: ${primaryAttendeeName}

Your QR code is attached. Save it for check-in.

Questions? contact@levyeromedia.com`.trim();
  }
}
