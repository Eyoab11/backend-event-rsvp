import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { createEvents, EventAttributes, DateArray } from 'ics';

// Illuminate Life Gala — hardcoded event details for calendar generation
const ILLUMINATE_EVENT = {
  name: 'Illuminate Life Gala',
  date: new Date('2026-06-07T00:00:00Z'), // June 7, 2026
  startTime: '18:00',
  endTime: '23:00',
  venueName: 'TBD Venue',
  venueAddress: '',
  venueCity: '',
  venueState: '',
  venueZipCode: '',
  description: 'An elegant evening celebrating life, purpose, and community.',
  dressCode: 'Black Tie',
};

@Injectable()
export class IlluminateEmailService {
  private async sendSimpleEmail(to: string, subject: string, html: string) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.warn(
        '[IlluminateEmail] RESEND_API_KEY not set — skipping email.',
      );
      return;
    }

    // Use FROM_EMAIL (matches the .env key), fall back to EMAIL_FROM for compatibility
    const from =
      process.env.FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      'noreply@levyeromomedia.com';

    try {
      const Resend = require('resend').Resend;
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from,
        to: [to],
        subject,
        html,
      });
      console.log(
        `[IlluminateEmail] Sent "${subject}" to ${to}`,
        result?.data?.id ?? '',
      );
    } catch (error) {
      console.error(
        `[IlluminateEmail] Failed to send to ${to}:`,
        error.message,
      );
    }
  }

  private async sendEmailWithAttachments(
    to: string,
    subject: string,
    html: string,
    attachments: Array<{ filename: string; content: Buffer }>,
  ) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.warn(
        '[IlluminateEmail] RESEND_API_KEY not set — skipping email.',
      );
      return;
    }

    const from =
      process.env.FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      'noreply@levyeromomedia.com';

    try {
      const Resend = require('resend').Resend;
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from,
        to: [to],
        subject,
        html,
        attachments: attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
        })),
      });
      console.log(
        `[IlluminateEmail] Sent "${subject}" to ${to}`,
        result?.data?.id ?? '',
      );
    } catch (error) {
      console.error(
        `[IlluminateEmail] Failed to send to ${to}:`,
        error.message,
      );
    }
  }

  /**
   * Generate a QR code image buffer for a booking.
   * The QR code encodes the booking ID so it can be scanned at check-in.
   */
  private async generateQrCode(bookingId: string): Promise<Buffer> {
    const dataUrl = await QRCode.toDataURL(bookingId, {
      width: 300,
      margin: 2,
      color: { dark: '#0a0a0a', light: '#ffffff' },
    });
    // Strip the data URL prefix and convert base64 to Buffer
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    return Buffer.from(base64, 'base64');
  }

  /**
   * Generate an ICS calendar file for an Illuminate Life Gala booking.
   */
  private generateCalendarFile(booking: any): Buffer {
    const eventDate = ILLUMINATE_EVENT.date;
    const [startHour, startMinute] = ILLUMINATE_EVENT.startTime
      .split(':')
      .map(Number);
    const [endHour, endMinute] = ILLUMINATE_EVENT.endTime
      .split(':')
      .map(Number);

    const start: DateArray = [
      eventDate.getUTCFullYear(),
      eventDate.getUTCMonth() + 1,
      eventDate.getUTCDate(),
      startHour,
      startMinute,
    ];

    const end: DateArray = [
      eventDate.getUTCFullYear(),
      eventDate.getUTCMonth() + 1,
      eventDate.getUTCDate(),
      endHour,
      endMinute,
    ];

    const seatInfo = booking.seatNumbers?.length
      ? `\nSeat(s): ${booking.seatNumbers.join(', ')}`
      : '';
    const tableInfo = booking.tableNumber
      ? `\nTable: ${booking.tableNumber}`
      : '';

    const description = [
      ILLUMINATE_EVENT.description,
      '',
      `Booking ID: ${booking.id}`,
      `Ticket: ${booking.ticketName || booking.ticketTier || 'Ticket'}`,
      `Dress Code: ${ILLUMINATE_EVENT.dressCode}`,
      seatInfo,
      tableInfo,
      '',
      'Please bring your QR code for check-in.',
    ]
      .filter((line) => line !== undefined)
      .join('\n');

    const location = [
      ILLUMINATE_EVENT.venueName,
      ILLUMINATE_EVENT.venueAddress,
      ILLUMINATE_EVENT.venueCity,
    ]
      .filter(Boolean)
      .join(', ');

    const icsEvent: EventAttributes = {
      start,
      end,
      title: ILLUMINATE_EVENT.name,
      description,
      location: location || ILLUMINATE_EVENT.venueName,
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      organizer: {
        name: 'Illuminate Life',
        email: process.env.FROM_EMAIL || 'info@levyeromomedia.com',
      },
      attendees: [
        {
          name: booking.customerName,
          email: booking.customerEmail,
          rsvp: true,
          partstat: 'ACCEPTED',
          role: 'REQ-PARTICIPANT',
        },
      ],
      alarms: [
        {
          action: 'display',
          description: 'Event reminder',
          trigger: { hours: 24, before: true },
        },
        {
          action: 'display',
          description: 'Event starting soon',
          trigger: { hours: 1, before: true },
        },
      ],
    };

    const { error, value } = createEvents([icsEvent]);
    if (error || !value) {
      console.error(
        '[IlluminateEmail] Failed to generate calendar file:',
        error?.message,
      );
      return Buffer.from('');
    }

    return Buffer.from(value, 'utf-8');
  }

  /**
   * Send a full confirmation email when a booking is confirmed and seats are assigned.
   * Includes: QR code attachment, calendar (.ics) attachment, seat number in body.
   */
  async sendConfirmedBookingEmail(booking: any) {
    const subject = `✅ You're Confirmed — Illuminate Life Gala`;

    const tierLabel = booking.ticketName || booking.ticketTier || 'Ticket';
    const seatNumbers =
      (booking.seatNumbers ?? []).join(', ') || 'To be assigned';
    const tableNumber = booking.tableNumber || 'To be assigned';

    // Generate QR code and calendar in parallel
    const [qrBuffer, calendarBuffer] = await Promise.all([
      this.generateQrCode(booking.id),
      Promise.resolve(this.generateCalendarFile(booking)),
    ]);

    const attachments: Array<{ filename: string; content: Buffer }> = [
      { filename: 'qr-code.png', content: qrBuffer },
    ];

    if (calendarBuffer.length > 0) {
      attachments.push({
        filename: 'illuminate-life-gala.ics',
        content: calendarBuffer,
      });
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;padding:36px 40px;text-align:center;">
            <p style="margin:0;color:#c9a84c;font-size:11px;letter-spacing:4px;text-transform:uppercase;">Illuminate Life Gala</p>
            <h1 style="margin:10px 0 0;color:#ffffff;font-size:30px;font-weight:300;letter-spacing:1px;">You're Confirmed</h1>
            <p style="margin:10px 0 0;color:#c9a84c;font-size:13px;">We look forward to welcoming you</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;color:#333;font-size:16px;">Dear ${booking.customerName},</p>
            <p style="margin:0 0 28px;color:#555;font-size:15px;line-height:1.7;">
              Your booking for the <strong>Illuminate Life Gala</strong> has been confirmed. 
              Your seat has been reserved — please find your details below.
            </p>

            <!-- Seat Highlight Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="padding:28px;text-align:center;">
                  <p style="margin:0 0 6px;color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Your Seat Assignment</p>
                  <p style="margin:0;color:#ffffff;font-size:32px;font-weight:bold;letter-spacing:2px;">${seatNumbers}</p>
                  ${tableNumber !== 'To be assigned' ? `<p style="margin:8px 0 0;color:#aaa;font-size:14px;">Table ${tableNumber}</p>` : ''}
                </td>
              </tr>
            </table>

            <!-- Booking Details Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 16px;color:#0a0a0a;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Booking Details</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;width:45%;">Booking ID</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;font-weight:bold;">${booking.id}</td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">Ticket Type</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;">${tierLabel}</td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">Quantity</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;">${booking.quantity ?? 1}</td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">Seat(s)</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;font-weight:bold;">${seatNumbers}</td>
                    </tr>
                    ${
                      tableNumber !== 'To be assigned'
                        ? `
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">Table</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;">${tableNumber}</td>
                    </tr>`
                        : ''
                    }
                    ${
                      booking.dietaryRestrictions
                        ? `
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">Dietary</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;">${booking.dietaryRestrictions}</td>
                    </tr>`
                        : ''
                    }
                    ${
                      booking.specialRequests
                        ? `
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">Special Requests</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;">${booking.specialRequests}</td>
                    </tr>`
                        : ''
                    }
                  </table>
                </td>
              </tr>
            </table>

            <!-- QR Code Section -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:24px;text-align:center;">
                  <p style="margin:0 0 12px;color:#0a0a0a;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Your Check-In QR Code</p>
                  <p style="margin:0 0 16px;color:#666;font-size:13px;line-height:1.5;">
                    Your QR code is attached to this email as <strong>qr-code.png</strong>.<br>
                    Please present it at the entrance for check-in.
                  </p>
                  <p style="margin:0;color:#888;font-size:12px;">Booking ID: <strong>${booking.id}</strong></p>
                </td>
              </tr>
            </table>

            <!-- Calendar Section -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8e3da;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 6px;color:#0a0a0a;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Add to Calendar</p>
                  <p style="margin:0;color:#666;font-size:13px;line-height:1.5;">
                    A calendar invite (<strong>illuminate-life-gala.ics</strong>) is attached. 
                    Open it to add the event to Google Calendar, Apple Calendar, or Outlook.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Event Info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 14px;color:#0a0a0a;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Event Information</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;width:35%;">Date</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:13px;">June 7, 2026</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">Time</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:13px;">6:00 PM – 11:00 PM</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">Dress Code</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:13px;">Black Tie</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#555;font-size:14px;line-height:1.6;">
              If you have any questions, please reply to this email or contact us directly.
            </p>
            <p style="margin:0;color:#555;font-size:14px;">
              We look forward to seeing you,<br>
              <strong>The Illuminate Life Team</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0a0a0a;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Illuminate Life Gala</p>
            <p style="margin:0;color:#555;font-size:11px;">© 2026 Illuminate Life. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this.sendEmailWithAttachments(
      booking.customerEmail,
      subject,
      html,
      attachments,
    );
  }

  /**
   * Send a seat reassignment email when seats are changed.
   * Includes: New QR code, new seat numbers, explanation of change.
   */
  async sendSeatReassignmentEmail(booking: any, oldSeatNumbers: string[]) {
    const subject = `🔄 Seat Reassignment — Illuminate Life Gala`;

    const tierLabel = booking.ticketName || booking.ticketTier || 'Ticket';
    const newSeatNumbers =
      (booking.seatNumbers ?? []).join(', ') || 'To be assigned';
    const oldSeats = oldSeatNumbers.join(', ');
    const tableNumber = booking.tableNumber || 'To be assigned';

    // Generate NEW QR code and calendar
    const [qrBuffer, calendarBuffer] = await Promise.all([
      this.generateQrCode(booking.id),
      Promise.resolve(this.generateCalendarFile(booking)),
    ]);

    const attachments: Array<{ filename: string; content: Buffer }> = [
      { filename: 'qr-code.png', content: qrBuffer },
    ];

    if (calendarBuffer.length > 0) {
      attachments.push({
        filename: 'illuminate-life-gala.ics',
        content: calendarBuffer,
      });
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;padding:36px 40px;text-align:center;">
            <p style="margin:0;color:#c9a84c;font-size:11px;letter-spacing:4px;text-transform:uppercase;">Illuminate Life Gala</p>
            <h1 style="margin:10px 0 0;color:#ffffff;font-size:30px;font-weight:300;letter-spacing:1px;">Seat Reassignment</h1>
            <p style="margin:10px 0 0;color:#c9a84c;font-size:13px;">Your seats have been updated</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;color:#333;font-size:16px;">Dear ${booking.customerName},</p>
            <p style="margin:0 0 28px;color:#555;font-size:15px;line-height:1.7;">
              We apologize for any inconvenience, but your seat assignment has been updated. 
              Please find your new seat details below.
            </p>

            <!-- Old Seats Notice -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff3cd;border:1px solid #ffc107;border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px;text-align:center;">
                  <p style="margin:0 0 6px;color:#856404;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:bold;">Previous Seats</p>
                  <p style="margin:0;color:#856404;font-size:18px;font-weight:bold;">${oldSeats}</p>
                </td>
              </tr>
            </table>

            <!-- New Seat Highlight Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:10px;margin-bottom:24px;">
              <tr>
                <td style="padding:28px;text-align:center;">
                  <p style="margin:0 0 6px;color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Your New Seat Assignment</p>
                  <p style="margin:0;color:#ffffff;font-size:32px;font-weight:bold;letter-spacing:2px;">${newSeatNumbers}</p>
                  ${tableNumber !== 'To be assigned' ? `<p style="margin:8px 0 0;color:#aaa;font-size:14px;">Table ${tableNumber}</p>` : ''}
                </td>
              </tr>
            </table>

            <!-- Booking Details Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 16px;color:#0a0a0a;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Booking Details</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;width:45%;">Booking ID</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;font-weight:bold;">${booking.id}</td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">Ticket Type</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;">${tierLabel}</td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">Quantity</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;">${booking.quantity ?? 1}</td>
                    </tr>
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">New Seat(s)</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;font-weight:bold;">${newSeatNumbers}</td>
                    </tr>
                    ${
                      tableNumber !== 'To be assigned'
                        ? `
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">Table</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;">${tableNumber}</td>
                    </tr>`
                        : ''
                    }
                    ${
                      booking.dietaryRestrictions
                        ? `
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">Dietary</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;">${booking.dietaryRestrictions}</td>
                    </tr>`
                        : ''
                    }
                    ${
                      booking.specialRequests
                        ? `
                    <tr>
                      <td style="padding:7px 0;color:#888;font-size:13px;">Special Requests</td>
                      <td style="padding:7px 0;color:#0a0a0a;font-size:13px;">${booking.specialRequests}</td>
                    </tr>`
                        : ''
                    }
                  </table>
                </td>
              </tr>
            </table>

            <!-- New QR Code Section -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:24px;text-align:center;">
                  <p style="margin:0 0 12px;color:#0a0a0a;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Your NEW Check-In QR Code</p>
                  <p style="margin:0 0 16px;color:#666;font-size:13px;line-height:1.5;">
                    A new QR code is attached to this email as <strong>qr-code.png</strong>.<br>
                    Please use this NEW QR code for check-in. Your previous QR code is no longer valid.
                  </p>
                  <p style="margin:0;color:#888;font-size:12px;">Booking ID: <strong>${booking.id}</strong></p>
                </td>
              </tr>
            </table>

            <!-- Event Info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 14px;color:#0a0a0a;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Event Information</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;width:35%;">Date</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:13px;">June 7, 2026</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">Time</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:13px;">6:00 PM – 11:00 PM</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#888;font-size:13px;">Dress Code</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:13px;">Black Tie</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;color:#555;font-size:14px;line-height:1.6;">
              We apologize for any inconvenience this change may cause. If you have any questions, please reply to this email or contact us directly.
            </p>
            <p style="margin:0;color:#555;font-size:14px;">
              We look forward to seeing you,<br>
              <strong>The Illuminate Life Team</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0a0a0a;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 4px;color:#c9a84c;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Illuminate Life Gala</p>
            <p style="margin:0;color:#555;font-size:11px;">© 2026 Illuminate Life. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this.sendEmailWithAttachments(
      booking.customerEmail,
      subject,
      html,
      attachments,
    );
  }

  async sendTicketBookingConfirmation(booking: any) {
    const subject = `Your Illuminate Life Gala Booking — ${booking.id}`;

    const tierLabel = booking.ticketName || booking.ticketTier || 'Ticket';
    const quantity = booking.quantity ?? 1;
    const pricePerUnit = Number(booking.pricePerUnit ?? 0).toFixed(2);
    const totalAmount = Number(booking.totalAmount ?? 0).toFixed(2);

    // Check if this is a Circle of Illumination (Table of 10) booking
    const isCircleOfIllumination =
      booking.ticketTier === 'Table of 10' ||
      booking.ticketName?.toLowerCase().includes('circle of illumination');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#c9a84c;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Illuminate Life Gala</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:28px;font-weight:300;letter-spacing:1px;">Booking Received</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 16px;color:#333;font-size:16px;">Dear ${booking.customerName},</p>
            <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">
              Thank you for your interest in the <strong>Illuminate Life Gala</strong>. 
              We have received your booking request and our team will confirm your reservation within 24–48 hours.
            </p>

            <!-- Booking Details Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f0;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 16px;color:#0a0a0a;font-size:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Booking Details</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;color:#666;font-size:14px;width:40%;">Booking ID</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:14px;font-weight:bold;">${booking.id}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#666;font-size:14px;">Ticket Type</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:14px;">${tierLabel}</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#666;font-size:14px;">Quantity</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:14px;">${quantity}</td>
                    </tr>
                    ${
                      !isCircleOfIllumination
                        ? `
                    <tr>
                      <td style="padding:6px 0;color:#666;font-size:14px;">Price per Unit</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:14px;">$${pricePerUnit}</td>
                    </tr>`
                        : ''
                    }
                    <tr style="border-top:1px solid #e0d9cc;">
                      <td style="padding:10px 0 6px;color:#0a0a0a;font-size:15px;font-weight:bold;">Total Amount</td>
                      <td style="padding:10px 0 6px;color:#c9a84c;font-size:15px;font-weight:bold;">$${totalAmount}</td>
                    </tr>
                    ${
                      booking.dietaryRestrictions
                        ? `
                    <tr>
                      <td style="padding:6px 0;color:#666;font-size:14px;">Dietary</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:14px;">${booking.dietaryRestrictions}</td>
                    </tr>`
                        : ''
                    }
                    ${
                      booking.specialRequests
                        ? `
                    <tr>
                      <td style="padding:6px 0;color:#666;font-size:14px;">Special Requests</td>
                      <td style="padding:6px 0;color:#0a0a0a;font-size:14px;">${booking.specialRequests}</td>
                    </tr>`
                        : ''
                    }
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.6;">
              Please save your <strong>Booking ID: ${booking.id}</strong> for your records. 
              You will receive a follow-up email once your booking is confirmed with payment details.
            </p>

            <p style="margin:0;color:#555;font-size:14px;">
              Best regards,<br>
              <strong>The Illuminate Life Team</strong>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0a0a0a;padding:20px 40px;text-align:center;">
            <p style="margin:0;color:#666;font-size:12px;">© 2026 Illuminate Life Gala. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this.sendSimpleEmail(booking.customerEmail, subject, html);
  }

  async sendSponsorInquiryConfirmation(booking: any) {
    const subject = 'Sponsorship Inquiry Received — Illuminate Life Gala';
    const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;margin:0 auto;overflow:hidden;max-width:600px;">
    <tr><td style="background:#0a0a0a;padding:32px 40px;text-align:center;">
      <p style="margin:0;color:#c9a84c;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Illuminate Life Gala</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:300;">Sponsorship Inquiry Received</h1>
    </td></tr>
    <tr><td style="padding:40px;">
      <p style="color:#333;font-size:16px;">Dear ${booking.customerName},</p>
      <p style="color:#555;font-size:15px;line-height:1.6;">Thank you for your interest in sponsoring the Illuminate Life Gala. We have received your inquiry and our partnerships team will contact you within 24 hours.</p>
      <table width="100%" style="background:#f9f6f0;border-radius:8px;margin:20px 0;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 12px;font-weight:bold;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Inquiry Details</p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Inquiry ID: <strong>${booking.id}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Company: <strong>${booking.companyName}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Sponsor Tier: <strong>${booking.sponsorTier}</strong></p>
        </td></tr>
      </table>
      <p style="color:#555;font-size:14px;">Best regards,<br><strong>The Illuminate Life Team</strong></p>
    </td></tr>
    <tr><td style="background:#0a0a0a;padding:16px 40px;text-align:center;">
      <p style="margin:0;color:#666;font-size:12px;">© 2026 Illuminate Life Gala</p>
    </td></tr>
  </table>
</body></html>`;
    await this.sendSimpleEmail(booking.customerEmail, subject, html);
  }

  async sendSponsorConfirmation(booking: any) {
    const subject = 'Sponsorship Confirmed — Illuminate Life Gala';
    const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;margin:0 auto;overflow:hidden;max-width:600px;">
    <tr><td style="background:#0a0a0a;padding:32px 40px;text-align:center;">
      <p style="margin:0;color:#c9a84c;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Illuminate Life Gala</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:300;">Sponsorship Confirmed</h1>
    </td></tr>
    <tr><td style="padding:40px;">
      <p style="color:#333;font-size:16px;">Dear ${booking.customerName},</p>
      <p style="color:#555;font-size:15px;line-height:1.6;">We are thrilled to confirm your sponsorship of the Illuminate Life Gala! Your support makes a tremendous difference in our mission to illuminate lives and create lasting impact.</p>
      <table width="100%" style="background:#f9f6f0;border-radius:8px;margin:20px 0;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 12px;font-weight:bold;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Sponsorship Details</p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Booking ID: <strong>${booking.id}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Company: <strong>${booking.companyName}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Sponsor Tier: <strong>${booking.sponsorTier}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Amount: <strong>$${Number(booking.totalAmount).toLocaleString()}</strong></p>
        </td></tr>
      </table>
      <p style="color:#555;font-size:15px;line-height:1.6;">Our team will be in touch shortly with next steps, including logo submission guidelines and recognition details.</p>
      <p style="color:#555;font-size:14px;margin-top:24px;">Best regards,<br><strong>The Illuminate Life Team</strong></p>
    </td></tr>
    <tr><td style="background:#0a0a0a;padding:16px 40px;text-align:center;">
      <p style="margin:0;color:#666;font-size:12px;">© 2026 Illuminate Life Gala</p>
    </td></tr>
  </table>
</body></html>`;
    await this.sendSimpleEmail(booking.customerEmail, subject, html);
  }

  async sendSeatAssignmentConfirmation(booking: any) {
    const subject = `Your Seat Assignment — Illuminate Life Gala`;
    const seatNumbers = (booking.seatNumbers ?? []).join(', ') || 'TBD';
    const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;margin:0 auto;overflow:hidden;max-width:600px;">
    <tr><td style="background:#0a0a0a;padding:32px 40px;text-align:center;">
      <p style="margin:0;color:#c9a84c;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Illuminate Life Gala</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:300;">Seats Assigned</h1>
    </td></tr>
    <tr><td style="padding:40px;">
      <p style="color:#333;font-size:16px;">Dear ${booking.customerName},</p>
      <p style="color:#555;font-size:15px;line-height:1.6;">Your seats have been assigned for the Illuminate Life Gala. We look forward to welcoming you!</p>
      <table width="100%" style="background:#f9f6f0;border-radius:8px;margin:20px 0;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 12px;font-weight:bold;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Seat Details</p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Booking ID: <strong>${booking.id}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Seat(s): <strong>${seatNumbers}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Table: <strong>${booking.tableNumber || 'N/A'}</strong></p>
        </td></tr>
      </table>
      <p style="color:#555;font-size:14px;">Best regards,<br><strong>The Illuminate Life Team</strong></p>
    </td></tr>
    <tr><td style="background:#0a0a0a;padding:16px 40px;text-align:center;">
      <p style="margin:0;color:#666;font-size:12px;">© 2026 Illuminate Life Gala</p>
    </td></tr>
  </table>
</body></html>`;
    await this.sendSimpleEmail(booking.customerEmail, subject, html);
  }

  async sendAdminNotification(type: string, booking: any) {
    const typeLabels: Record<string, string> = {
      new_booking: 'New Ticket Booking',
      new_sponsor: 'New Sponsor Inquiry',
      new_branding: 'New Branding Inquiry',
    };
    const label = typeLabels[type] || 'New Booking';
    const subject = `🔔 ${label} — ${booking.id}`;

    const tierInfo = booking.ticketTier
      ? `<p style="margin:4px 0;font-size:14px;color:#555;">Ticket Tier: <strong>${booking.ticketName || booking.ticketTier}</strong></p>
         <p style="margin:4px 0;font-size:14px;color:#555;">Quantity: <strong>${booking.quantity}</strong></p>
         <p style="margin:4px 0;font-size:14px;color:#c9a84c;font-weight:bold;">Total: $${Number(booking.totalAmount ?? 0).toFixed(2)}</p>`
      : `<p style="margin:4px 0;font-size:14px;color:#555;">Sponsor Tier: <strong>${booking.sponsorTier}</strong></p>
         <p style="margin:4px 0;font-size:14px;color:#555;">Company: <strong>${booking.companyName}</strong></p>`;

    const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;margin:0 auto;overflow:hidden;max-width:600px;">
    <tr><td style="background:#0a0a0a;padding:24px 40px;">
      <p style="margin:0;color:#c9a84c;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Admin Notification</p>
      <h2 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:400;">${label}</h2>
    </td></tr>
    <tr><td style="padding:32px 40px;">
      <table width="100%" style="background:#f9f6f0;border-radius:8px;margin-bottom:20px;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 12px;font-weight:bold;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Customer</p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Name: <strong>${booking.customerName}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Email: <strong>${booking.customerEmail}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Phone: <strong>${booking.customerPhone}</strong></p>
        </td></tr>
      </table>
      <table width="100%" style="background:#f0f4f9;border-radius:8px;margin-bottom:20px;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 12px;font-weight:bold;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Booking</p>
          <p style="margin:4px 0;font-size:14px;color:#555;">ID: <strong>${booking.id}</strong></p>
          ${tierInfo}
          <p style="margin:4px 0;font-size:14px;color:#555;">Time: <strong>${new Date().toLocaleString()}</strong></p>
        </td></tr>
      </table>
      <a href="${process.env.ADMIN_URL || 'http://localhost:3001'}/bookings" 
         style="display:inline-block;background:#0a0a0a;color:#c9a84c;padding:12px 24px;text-decoration:none;border-radius:6px;font-size:14px;letter-spacing:1px;">
        View in Dashboard →
      </a>
    </td></tr>
    <tr><td style="background:#0a0a0a;padding:16px 40px;text-align:center;">
      <p style="margin:0;color:#666;font-size:12px;">Illuminate Life Gala — Admin Notifications</p>
    </td></tr>
  </table>
</body></html>`;

    const adminEmail =
      process.env.ADMIN_NOTIFICATION_EMAIL ||
      process.env.ADMIN_EMAIL ||
      'admin@levyeromomedia.com';
    await this.sendSimpleEmail(adminEmail, subject, html);
  }

  // Send Plus One confirmation email
  async sendPlusOneConfirmation(booking: any, plusOne: any) {
    const subject = `You're Invited! Illuminate Life Gala — Plus One Confirmation`;

    // Generate QR code as buffer (for attachment)
    const qrBuffer = await this.generateQrCode(plusOne.qrCode);

    const seatInfo = plusOne.seatNumber
      ? `<p style="margin:4px 0;font-size:14px;color:#555;">Your Seat: <strong>${plusOne.seatNumber}</strong></p>`
      : `<p style="margin:4px 0;font-size:14px;color:#555;">Seat assignment coming soon</p>`;

    const dietaryInfo = plusOne.dietaryRestrictions
      ? `<p style="margin:4px 0;font-size:14px;color:#555;">Dietary Restrictions: <strong>${plusOne.dietaryRestrictions}</strong></p>`
      : '';

    const specialRequestsInfo = plusOne.specialRequests
      ? `<p style="margin:4px 0;font-size:14px;color:#555;">Special Requests: <strong>${plusOne.specialRequests}</strong></p>`
      : '';

    const html = `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:40px 0;">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;margin:0 auto;overflow:hidden;max-width:600px;">
    <tr><td style="background:#0a0a0a;padding:32px 40px;text-align:center;">
      <p style="margin:0;color:#c9a84c;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Illuminate Life Gala</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:300;">You're Invited as a Plus One!</h1>
    </td></tr>
    <tr><td style="padding:40px;">
      <p style="color:#333;font-size:16px;">Dear ${plusOne.name},</p>
      <p style="color:#555;font-size:15px;line-height:1.6;">You've been invited to join <strong>${booking.customerName}</strong> at the Illuminate Life Gala — an elegant evening celebrating life, purpose, and community.</p>
      
      <table width="100%" style="background:#f9f6f0;border-radius:8px;margin:20px 0;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 12px;font-weight:bold;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Event Details</p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Date: <strong>Friday, June 12, 2026</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Time: <strong>6:00 PM - 11:30 PM</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Venue: <strong>The Beverly Hilton</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Address: <strong>9876 Wilshire Blvd, Beverly Hills, CA 90210</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Dress Code: <strong>Black Tie</strong></p>
        </td></tr>
      </table>

      <table width="100%" style="background:#f9f6f0;border-radius:8px;margin:20px 0;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 12px;font-weight:bold;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Your Details</p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Name: <strong>${plusOne.name}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#555;">Email: <strong>${plusOne.email}</strong></p>
          ${seatInfo}
          ${dietaryInfo}
          ${specialRequestsInfo}
          <p style="margin:4px 0;font-size:14px;color:#555;">Invited by: <strong>${booking.customerName}</strong></p>
        </td></tr>
      </table>

      <!-- QR Code Section -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ede8;border-radius:8px;margin-bottom:24px;">
        <tr>
          <td style="padding:24px;text-align:center;">
            <p style="margin:0 0 12px;color:#0a0a0a;font-size:12px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Your Check-In QR Code</p>
            <p style="margin:0 0 16px;color:#666;font-size:13px;line-height:1.5;">
              Your QR code is attached to this email as <strong>qr-code.png</strong>.<br>
              Please present it at the entrance for check-in.
            </p>
            <p style="margin:0;color:#888;font-size:12px;">QR Code: <strong>${plusOne.qrCode}</strong></p>
          </td>
        </tr>
      </table>

      <p style="color:#555;font-size:15px;line-height:1.6;">We look forward to welcoming you to an unforgettable evening of inspiration, connection, and impact.</p>
      <p style="color:#555;font-size:14px;margin-top:24px;">Best regards,<br><strong>The Illuminate Life Team</strong></p>
    </td></tr>
    <tr><td style="background:#0a0a0a;padding:16px 40px;text-align:center;">
      <p style="margin:0;color:#666;font-size:12px;">© 2026 Illuminate Life Gala</p>
    </td></tr>
  </table>
</body></html>`;

    // Generate calendar invite
    // Create a booking-like object for the Plus One
    const plusOneBooking = {
      id: plusOne.id,
      customerName: plusOne.name,
      customerEmail: plusOne.email,
      ticketName: `Plus One Guest of ${booking.customerName}`,
      ticketTier: 'Plus One',
      seatNumbers: plusOne.seatNumber ? [plusOne.seatNumber] : [],
      tableNumber: plusOne.seatNumber
        ? plusOne.seatNumber.match(/^T(\d+)-/)?.[1]
        : null,
    };
    const calendarBuffer = this.generateCalendarFile(plusOneBooking);

    // Prepare attachments
    const attachments: Array<{ filename: string; content: Buffer }> = [
      { filename: 'qr-code.png', content: qrBuffer },
    ];

    if (calendarBuffer.length > 0) {
      attachments.push({
        filename: 'illuminate-life-gala.ics',
        content: calendarBuffer,
      });
    }

    // Send email with QR code and calendar attachment
    await this.sendEmailWithAttachments(
      plusOne.email,
      subject,
      html,
      attachments,
    );
  }
}
