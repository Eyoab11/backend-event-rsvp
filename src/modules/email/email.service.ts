import { Injectable, Logger } from '@nestjs/common';
import { Event, Attendee, PlusOne } from '@prisma/client';

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
  private apiKey: string | undefined;
  private fromEmail: string;
  private frontendUrl: string;

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY;
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@levyeromedia.com';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (!this.apiKey) {
      this.logger.warn('BREVO_API_KEY not set. Email functionality will be disabled.');
      return;
    }

    this.logger.log('Email service initialized with Brevo API');
  }

  /**
   * Send email using Brevo API with inline images support
   */
  private async sendEmail(
    to: string, 
    subject: string, 
    htmlContent: string, 
    textContent: string, 
    attachments?: Array<{ name: string; content: string }>,
    inlineImages?: Array<{ name: string; content: string; cid: string }>
  ): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('Email service not configured. Skipping email.');
      return;
    }

    try {
      const payload: any = {
        sender: { email: this.fromEmail },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent,
      };

      // Add regular attachments (like calendar files)
      if (attachments && attachments.length > 0) {
        payload.attachment = attachments;
      }

      // Add inline images (like QR codes) - Brevo uses 'attachment' with CID
      if (inlineImages && inlineImages.length > 0) {
        if (!payload.attachment) {
          payload.attachment = [];
        }
        // Add inline images to attachments array
        payload.attachment = [...payload.attachment, ...inlineImages];
      }

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Brevo API error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      this.logger.log(`Email sent successfully to ${to}, messageId: ${result.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Send confirmation email to attendee
   */
  async sendConfirmationEmail(data: ConfirmationEmailData): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn('Email service not configured. Skipping confirmation email.');
      return;
    }

    const { event, attendee, plusOne, qrCodeImage, calendarFile } = data;

    try {
      const htmlContent = this.generateConfirmationEmailHtml(data);
      const textContent = this.generateConfirmationEmailText(data);

      const attachments: Array<{ name: string; content: string }> = [];
      const inlineImages: Array<{ name: string; content: string; cid: string }> = [];
      
      // Add calendar attachment if provided
      if (calendarFile) {
        attachments.push({
          name: `${event.eventName.toLowerCase().replace(/\s+/g, '-')}.ics`,
          content: Buffer.from(calendarFile).toString('base64'),
        });
      }

      // Add QR code as inline image if provided
      if (qrCodeImage) {
        // Extract base64 content from data URL (remove "data:image/png;base64," prefix)
        const base64Content = qrCodeImage.replace(/^data:image\/\w+;base64,/, '');
        inlineImages.push({
          name: 'qr-code.png',
          content: base64Content,
          cid: 'qrcode@attendee',
        });
      }

      await this.sendEmail(
        attendee.email,
        `Confirmed: ${event.eventName}`,
        htmlContent,
        textContent,
        attachments.length > 0 ? attachments : undefined,
        inlineImages.length > 0 ? inlineImages : undefined
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
    if (!this.apiKey) {
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
    if (!this.apiKey) {
      this.logger.warn('Email service not configured. Skipping plus-one confirmation email.');
      return;
    }

    const { event, plusOne, primaryAttendeeName, qrCodeImage, calendarFile } = data;

    try {
      const htmlContent = this.generatePlusOneConfirmationEmailHtml(data);
      const textContent = this.generatePlusOneConfirmationEmailText(data);

      const attachments: Array<{ name: string; content: string }> = [];
      const inlineImages: Array<{ name: string; content: string; cid: string }> = [];
      
      // Add calendar attachment if provided
      if (calendarFile) {
        attachments.push({
          name: `${event.eventName.toLowerCase().replace(/\s+/g, '-')}.ics`,
          content: Buffer.from(calendarFile).toString('base64'),
        });
      }

      // Add QR code as inline image if provided
      if (qrCodeImage) {
        // Extract base64 content from data URL (remove "data:image/png;base64," prefix)
        const base64Content = qrCodeImage.replace(/^data:image\/\w+;base64,/, '');
        inlineImages.push({
          name: 'qr-code-plusone.png',
          content: base64Content,
          cid: 'qrcode@plusone',
        });
      }

      await this.sendEmail(
        plusOne.email,
        `Confirmed: ${event.eventName}`,
        htmlContent,
        textContent,
        attachments.length > 0 ? attachments : undefined,
        inlineImages.length > 0 ? inlineImages : undefined
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
    if (!this.apiKey) {
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

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">You're Confirmed!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${attendee.name},</p>
    
    <p>We're excited to confirm your registration for <strong>${event.eventName}</strong>!</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="margin-top: 0; color: #667eea;">Event Details</h2>
      <p><strong>Date:</strong> ${eventDate}</p>
      <p><strong>Time:</strong> ${event.eventStartTime} - ${event.eventEndTime}</p>
      <p><strong>Venue:</strong> ${event.venueName}</p>
      <p><strong>Address:</strong> ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}</p>
      <p><strong>Dress Code:</strong> ${event.dressCode}</p>
    </div>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">Your Registration</h3>
      <p><strong>Registration ID:</strong> ${attendee.registrationId}</p>
      <p><strong>Name:</strong> ${attendee.name}</p>
      <p><strong>Company:</strong> ${attendee.company}</p>
      ${plusOne ? `<p><strong>Plus One:</strong> ${plusOne.name} (${plusOne.company}) - They will receive a separate email with their own QR code</p>` : ''}
    </div>
    
    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <p style="margin: 0;"><strong>Important:</strong> Your personal QR code is attached to this email. Please save it or take a screenshot for check-in at the event. ${plusOne ? 'Your plus-one will receive their own QR code via email.' : ''}</p>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      If you have any questions, please contact us at events@levyeromedia.com
    </p>
    
    <p style="color: #666; font-size: 14px;">
      See you at the event!<br>
      <strong>LEM Ventures Team</strong>
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

    return `
You're Confirmed!

Hi ${attendee.name},

We're excited to confirm your registration for ${event.eventName}!

EVENT DETAILS
Date: ${eventDate}
Time: ${event.eventStartTime} - ${event.eventEndTime}
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

If you have any questions, please contact us at events@levyeromedia.com

See you at the event!
LEM Ventures Team
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

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Waitlist Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">You're on the Waitlist</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${attendee.name},</p>
    
    <p>Thank you for your interest in <strong>${event.eventName}</strong>!</p>
    
    <p>The event is currently at capacity, but we've added you to our waitlist. We'll notify you immediately if a spot becomes available.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f5576c;">
      <h2 style="margin-top: 0; color: #f5576c;">Event Details</h2>
      <p><strong>Date:</strong> ${eventDate}</p>
      <p><strong>Time:</strong> ${event.eventStartTime} - ${event.eventEndTime}</p>
      <p><strong>Venue:</strong> ${event.venueName}</p>
      <p><strong>Address:</strong> ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}</p>
    </div>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #f5576c;">Your Registration</h3>
      <p><strong>Registration ID:</strong> ${attendee.registrationId}</p>
      <p><strong>Name:</strong> ${attendee.name}</p>
      <p><strong>Company:</strong> ${attendee.company}</p>
      ${plusOne ? `<p><strong>Plus One:</strong> ${plusOne.name} (${plusOne.company})</p>` : ''}
      <p><strong>Status:</strong> Waitlisted</p>
    </div>
    
    <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0c5460;">
      <p style="margin: 0;">We'll send you an email if a spot opens up. Keep an eye on your inbox!</p>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      If you have any questions, please contact us at events@levyeromedia.com
    </p>
    
    <p style="color: #666; font-size: 14px;">
      Thank you for your understanding!<br>
      <strong>LEM Ventures Team</strong>
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

    return `
You're on the Waitlist

Hi ${attendee.name},

Thank you for your interest in ${event.eventName}!

The event is currently at capacity, but we've added you to our waitlist. We'll notify you immediately if a spot becomes available.

EVENT DETAILS
Date: ${eventDate}
Time: ${event.eventStartTime} - ${event.eventEndTime}
Venue: ${event.venueName}
Address: ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}

YOUR REGISTRATION
Registration ID: ${attendee.registrationId}
Name: ${attendee.name}
Company: ${attendee.company}
${plusOne ? `Plus One: ${plusOne.name} (${plusOne.company})` : ''}
Status: Waitlisted

We'll send you an email if a spot opens up. Keep an eye on your inbox!

If you have any questions, please contact us at events@levyeromedia.com

Thank you for your understanding!
LEM Ventures Team
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

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Event Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">You're Confirmed!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 18px; margin-bottom: 20px;">Hi ${plusOne.name},</p>
    
    <p>We're excited to confirm your registration for <strong>${event.eventName}</strong> as a guest of ${primaryAttendeeName}!</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h2 style="margin-top: 0; color: #667eea;">Event Details</h2>
      <p><strong>Date:</strong> ${eventDate}</p>
      <p><strong>Time:</strong> ${event.eventStartTime} - ${event.eventEndTime}</p>
      <p><strong>Venue:</strong> ${event.venueName}</p>
      <p><strong>Address:</strong> ${event.venueAddress}, ${event.venueCity}, ${event.venueState} ${event.venueZipCode}</p>
      <p><strong>Dress Code:</strong> ${event.dressCode}</p>
    </div>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">Your Registration</h3>
      <p><strong>Registration ID:</strong> ${plusOne.registrationId}</p>
      <p><strong>Name:</strong> ${plusOne.name}</p>
      <p><strong>Company:</strong> ${plusOne.company}</p>
      <p><strong>Attending with:</strong> ${primaryAttendeeName}</p>
    </div>
    
    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <p style="margin: 0;"><strong>Important:</strong> Your personal QR code is attached to this email. Please save it or take a screenshot for check-in at the event. Each guest has their own unique QR code for independent check-in.</p>
    </div>
    
    <p style="color: #666; font-size: 14px; margin-top: 30px;">
      If you have any questions, please contact us at events@levyeromedia.com
    </p>
    
    <p style="color: #666; font-size: 14px;">
      See you at the event!<br>
      <strong>LEM Ventures Team</strong>
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

    return `
You're Confirmed!

Hi ${plusOne.name},

We're excited to confirm your registration for ${event.eventName} as a guest of ${primaryAttendeeName}!

EVENT DETAILS
Date: ${eventDate}
Time: ${event.eventStartTime} - ${event.eventEndTime}
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

If you have any questions, please contact us at events@levyeromedia.com

See you at the event!
LEM Ventures Team
    `.trim();
  }
}
