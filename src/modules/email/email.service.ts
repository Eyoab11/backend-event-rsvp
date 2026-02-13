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

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.FROM_EMAIL;
    const frontendUrl = process.env.FRONTEND_URL;

    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY not set. Email functionality will be disabled.');
      // Set dummy values to satisfy TypeScript, but service won't be functional
      this.fromEmail = '';
      this.frontendUrl = '';
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
    this.resend = new Resend(apiKey);
    this.logger.log('Email service initialized with Resend API');
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
    const { event, attendee, plusOne, qrCodeImage } = data;
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
  <title>Event Confirmation</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #ffffff; max-width: 600px; margin: 0 auto; padding: 0; background-color: #000000;">
  
  <!-- Hero Banner -->
  <div style="position: relative; height: 200px; overflow: hidden; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);">
    <img src="https://t4.ftcdn.net/jpg/05/64/91/35/240_F_564913571_s7Dbf5hVB1T1GTeG2GFDEqNOgmvPz87k.jpg" alt="Event Banner" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.4;" />
    <div style="position: absolute; inset: 0; background: linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(217,119,6,0.3) 100%);"></div>
    
    <div style="position: relative; z-index: 1; text-align: center; padding: 60px 20px 20px;">
      <h1 style="font-family: 'Playfair Display', Georgia, serif; color: #ffffff; margin: 0 0 8px 0; font-size: 42px; font-weight: 900; letter-spacing: 1px; text-shadow: 2px 2px 8px rgba(0,0,0,0.5);">You're Confirmed!</h1>
      <p style="color: #fbbf24; font-size: 16px; margin: 0; font-weight: 500; text-shadow: 1px 1px 3px rgba(0,0,0,0.5);">🥂 We can't wait to celebrate with you 🍷</p>
    </div>
  </div>
  
  <!-- Main Content -->
  <div style="background: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%); padding: 25px 20px;">
    <p style="font-size: 18px; margin: 0 0 15px 0; color: #ffffff; font-weight: 500;">Hi ${attendee.name},</p>
    
    <p style="color: #e5e5e5; margin: 0 0 20px 0; font-size: 15px;">We're excited to confirm your registration for <strong style="color: #f59e0b;">${event.eventName}</strong>!</p>
    
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
    
    <!-- Registration Card -->
    <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin: 0 0 20px 0; border: 1px solid rgba(255,255,255,0.1);">
      <h3 style="font-family: 'Playfair Display', Georgia, serif; margin: 0 0 12px 0; color: #f59e0b; font-size: 22px; font-weight: 700;">Your Registration</h3>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 14px;"><strong style="color: #fbbf24;">ID:</strong> ${attendee.registrationId}</p>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 14px;"><strong style="color: #fbbf24;">Name:</strong> ${attendee.name}</p>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 14px;"><strong style="color: #fbbf24;">Company:</strong> ${attendee.company}</p>
      ${plusOne ? `<p style="margin: 8px 0; color: #e5e5e5; font-size: 14px;"><strong style="color: #fbbf24;">Plus One:</strong> ${plusOne.name} (${plusOne.company})</p>` : ''}
    </div>
    
    <!-- Important Notice -->
    <div style="background: linear-gradient(135deg, rgba(245,158,11,0.2) 0%, rgba(217,119,6,0.15) 100%); padding: 15px; border-radius: 8px; margin: 0 0 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #ffffff; font-size: 14px; line-height: 1.6;"><strong style="color: #fbbf24;">📱 Important:</strong> Your QR code is attached. Save it for check-in at the event.${plusOne ? ' Your plus-one will receive their own QR code.' : ''}</p>
    </div>
    
    <!-- Divider -->
    <div style="margin: 20px 0; text-align: center;">
      <span style="font-size: 24px;">🥂 ✨ 🍷</span>
    </div>
    
    <p style="color: #999999; font-size: 13px; margin: 15px 0 0 0; line-height: 1.5;">
      Questions? Contact us at <a href="mailto:contact@levyeromedia.com" style="color: #f59e0b; text-decoration: none;">contact@levyeromedia.com</a>
    </p>
    
    <p style="color: #999999; font-size: 13px; margin: 10px 0 0 0;">
      See you at the event!<br>
      <strong style="color: #f59e0b;">LEM Team</strong>
    </p>
  </div>
</body>
</html>
    `.trim();
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

    return `
You're Confirmed!

Hi ${attendee.name},

We're excited to confirm your registration for ${event.eventName}!

EVENT DETAILS
Date: ${eventDate}
Time: ${startTime} - ${endTime}
Venue: ${event.venueName}
Address: ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}
Dress Code: ${event.dressCode}

YOUR REGISTRATION
Registration ID: ${attendee.registrationId}
Name: ${attendee.name}
Company: ${attendee.company}
${plusOne ? `Plus One: ${plusOne.name} (${plusOne.company})` : ''}

IMPORTANT: Your personal QR code is attached to this email. Please save it or take a screenshot for check-in at the event.
${plusOne ? 'Your plus-one will receive their own QR code via email.' : ''}

If you have any questions, please contact us at contact@levyeromedia.com

See you at the event!
LEM Team
    `.trim();
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
    const { event, plusOne, primaryAttendeeName, qrCodeImage } = data;
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
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  <title>Event Confirmation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.5; color: #ffffff; max-width: 600px; margin: 0 auto; padding: 0; background-color: #000000;">
  
  <!-- Banner Image -->
  <div style="width: 100%; overflow: hidden;">
    <img src="https://t4.ftcdn.net/jpg/05/64/91/35/240_F_564913571_s7Dbf5hVB1T1GTeG2GFDEqNOgmvPz87k.jpg" alt="Event Banner" style="width: 100%; height: auto; display: block; max-height: 200px; object-fit: cover;">
  </div>
  
  <div style="background: #000000; padding: 20px;">
    <h1 style="font-family: 'Playfair Display', serif; color: #f59e0b; margin: 0 0 15px 0; font-size: 42px; font-weight: 700; text-align: center;">You're Confirmed! 🥂</h1>
    
    <p style="font-size: 18px; margin: 15px 0; color: #ffffff;">Hi ${plusOne.name},</p>
    
    <p style="color: #e5e5e5; margin: 10px 0; font-size: 15px;">We're excited to confirm your registration for <strong style="color: #f59e0b;">${event.eventName}</strong> as a guest of ${primaryAttendeeName}! 🎉</p>
    
    <!-- Event Details Card -->
    <div style="background: rgba(245, 158, 11, 0.08); padding: 18px; border-radius: 8px; margin: 15px 0; border: 1px solid rgba(245, 158, 11, 0.2);">
      <h2 style="font-family: 'Playfair Display', serif; margin: 0 0 12px 0; color: #f59e0b; font-size: 26px; font-weight: 600;">Event Details</h2>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 15px;"><strong style="color: #fbbf24;">Date:</strong> ${eventDate}</p>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 15px;"><strong style="color: #fbbf24;">Time:</strong> ${startTime} - ${endTime}</p>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 15px;"><strong style="color: #fbbf24;">Venue:</strong> ${event.venueName}</p>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 15px;"><strong style="color: #fbbf24;">Address:</strong> ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}</p>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 15px;"><strong style="color: #fbbf24;">Dress Code:</strong> ${event.dressCode}</p>
    </div>
    
    <!-- Registration Card -->
    <div style="background: rgba(255, 255, 255, 0.05); padding: 18px; border-radius: 8px; margin: 15px 0; border: 1px solid rgba(255, 255, 255, 0.1);">
      <h3 style="font-family: 'Playfair Display', serif; margin: 0 0 12px 0; color: #f59e0b; font-size: 22px; font-weight: 600;">Your Registration</h3>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 15px;"><strong style="color: #fbbf24;">Registration ID:</strong> ${plusOne.registrationId}</p>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 15px;"><strong style="color: #fbbf24;">Name:</strong> ${plusOne.name}</p>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 15px;"><strong style="color: #fbbf24;">Company:</strong> ${plusOne.company}</p>
      <p style="margin: 8px 0; color: #e5e5e5; font-size: 15px;"><strong style="color: #fbbf24;">Attending with:</strong> ${primaryAttendeeName}</p>
    </div>
    
    <!-- Important Notice -->
    <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.15) 100%); padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #ffffff; font-size: 14px;"><strong style="color: #fbbf24;">Important:</strong> Your personal QR code is attached to this email. Please save it or take a screenshot for check-in at the event. Each guest has their own unique QR code for independent check-in. ✨</p>
    </div>
    
    <div style="text-align: center; margin: 20px 0;">
      <div style="display: inline-block; width: 60px; height: 2px; background: linear-gradient(90deg, transparent, #f59e0b, transparent);"></div>
      <span style="margin: 0 10px; color: #f59e0b; font-size: 20px;">🍷</span>
      <div style="display: inline-block; width: 60px; height: 2px; background: linear-gradient(90deg, transparent, #f59e0b, transparent);"></div>
    </div>
    
    <p style="color: #999999; font-size: 14px; margin: 15px 0;">
      If you have any questions, please contact us at contact@levyeromedia.com
    </p>
    
    <p style="color: #999999; font-size: 14px; margin: 10px 0;">
      See you at the event! 🎊<br>
      <strong style="color: #f59e0b;">LEM Team</strong>
    </p>
  </div>
</body>
</html>
    `.trim();
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

    return `
You're Confirmed!

Hi ${plusOne.name},

We're excited to confirm your registration for ${event.eventName} as a guest of ${primaryAttendeeName}!

EVENT DETAILS
Date: ${eventDate}
Time: ${startTime} - ${endTime}
Venue: ${event.venueName}
Address: ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}
Dress Code: ${event.dressCode}

YOUR REGISTRATION
Registration ID: ${plusOne.registrationId}
Name: ${plusOne.name}
Company: ${plusOne.company}
Attending with: ${primaryAttendeeName}

IMPORTANT: Your personal QR code is attached to this email. Please save it or take a screenshot for check-in at the event. Each guest has their own unique QR code.
Your Registration ID: ${plusOne.registrationId}

If you have any questions, please contact us at contact@levyeromedia.com

See you at the event!
LEM Team
    `.trim();
  }
}
