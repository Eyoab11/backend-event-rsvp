# Email Module Usage

The Email module handles sending confirmation and waitlist emails to attendees using Resend.

## Configuration

Add these environment variables to your `.env` file:

```env
RESEND_API_KEY="re_xxxxxxxxx"
FROM_EMAIL="Events <noreply@yourdomain.com>"
FRONTEND_URL="http://localhost:3000"
```

### Getting a Resend API Key

1. Sign up at [resend.com](https://resend.com)
2. **Verify your domain** (required for production)
   - Add DNS records (SPF, DKIM, DMARC)
   - Wait for verification (usually a few minutes)
3. Create an API key in the dashboard
4. Add it to your `.env` file

**Important:** For production, you must verify your domain. The `FROM_EMAIL` must use your verified domain.

## Features

### Confirmation Email
Sent when an attendee successfully registers and is confirmed.

**Includes:**
- Event details (date, time, venue, dress code)
- Attendee information and registration ID
- Plus-one details (if applicable)
- QR code attachment (PNG image)
- Calendar file attachment (.ics)
- Branded HTML template

### Waitlist Email
Sent when an attendee registers but the event is at capacity.

**Includes:**
- Event details
- Attendee information and registration ID
- Plus-one details (if applicable)
- Waitlist status notification
- Branded HTML template

## Email Templates

Both emails include:
- **HTML version**: Branded, responsive design with gradients and styling
- **Plain text version**: Fallback for email clients that don't support HTML
- **Responsive design**: Works on desktop and mobile devices

### Confirmation Email Design
- Purple gradient header
- Event details in a highlighted box
- Registration information section
- Important notice about QR code attachment
- Professional, branded design

### Waitlist Email Design
- Pink/red gradient header
- Event details in a highlighted box
- Registration information with waitlist status
- Information notice about spot availability

## Integration

The email service is automatically integrated with the RSVP flow:

```typescript
// In RsvpService.submitRsvp()
if (status === AttendeeStatus.CONFIRMED) {
  // Generate calendar file
  const calendarFile = this.calendarService.generateCalendarFile({
    event,
    attendee: result.attendee,
  });

  // Send confirmation email with calendar attachment
  await this.emailService.sendConfirmationEmail({
    event,
    attendee: result.attendee,
    plusOne: result.plusOne,
    calendarFile,
  });
} else {
  // Send waitlist email
  await this.emailService.sendWaitlistEmail({
    event,
    attendee: result.attendee,
    plusOne: result.plusOne,
  });
}
```

## Error Handling

The email service includes graceful error handling:
- If `RESEND_API_KEY` is not set, emails are skipped with a warning log
- Email failures don't prevent registration from completing
- All errors are logged for debugging

## Testing

### Without Real Emails (Development)
Simply don't set `RESEND_API_KEY` in your `.env` file. The service will log warnings but won't fail.

### With Real Emails (Testing)
1. Get a Resend API key
2. Verify your domain in Resend dashboard
3. Add `RESEND_API_KEY` to `.env`
4. Set `FROM_EMAIL` to use your verified domain
5. Submit an RSVP and check your email

### Unit Tests
Run the email service tests:
```bash
npm test -- email.service.spec.ts
```

## Customization

### Changing Email Templates
Edit the private methods in `email.service.ts`:
- `generateConfirmationEmailHtml()` - HTML confirmation template
- `generateConfirmationEmailText()` - Plain text confirmation
- `generateWaitlistEmailHtml()` - HTML waitlist template
- `generateWaitlistEmailText()` - Plain text waitlist

### Changing Sender Email
Update the `FROM_EMAIL` environment variable.

### Changing Frontend URL
Update the `FRONTEND_URL` environment variable to change the QR code link.

## Future Enhancements

Potential additions:
- Reminder emails (7 days before, 24 hours before)
- Cancellation confirmation emails
- Waitlist promotion emails (when a spot opens)
- Admin notification emails
- Email templates with dynamic branding
- Email tracking and analytics
