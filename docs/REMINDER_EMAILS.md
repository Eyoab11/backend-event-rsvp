# Automated Reminder Emails

This document explains the automated reminder email system for pending invitations.

## Overview

The reminder email system automatically sends follow-up emails to invitees who haven't confirmed their attendance. Each reminder includes:

- **Countdown Timer**: Shows days remaining until the event
- **Responsive Design**: Looks great on mobile and desktop devices
- **Same Layout**: Maintains consistency with the original invitation
- **Urgent Call-to-Action**: Encourages immediate RSVP

## Features

### 1. Countdown Display
- Large, prominent countdown showing days left
- Gradient background for visual impact
- Responsive sizing (larger on desktop, smaller on mobile)
- Singular/plural text handling ("1 Day Left" vs "14 Days Left")

### 2. Automated Scheduling
- Configurable reminder intervals (default: 7 days)
- Automatic checking for pending invites
- Tracks reminder history to avoid spam
- Only sends to unused, non-expired invites

### 3. Smart Tracking
- Records when each reminder was sent
- Counts total reminders per invite
- Prevents duplicate reminders within interval
- Stops sending after event date passes

## Configuration

Add these environment variables to your `.env` file:

```bash
# Enable/disable automated reminder emails
ENABLE_AUTO_REMINDERS="true"

# How many days between reminder emails (default: 7)
REMINDER_INTERVAL_DAYS="7"

# How often to check for pending reminders in hours (default: 24)
REMINDER_CHECK_INTERVAL_HOURS="24"
```

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AUTO_REMINDERS` | `false` | Enable/disable automated reminders |
| `REMINDER_INTERVAL_DAYS` | `7` | Days between reminder emails |
| `REMINDER_CHECK_INTERVAL_HOURS` | `24` | Hours between checking for pending reminders |

## API Endpoints

### 1. Send Single Reminder
```http
POST /invite/send-reminder/:inviteId
```

Manually send a reminder email for a specific invite.

**Response:**
```json
{
  "message": "Reminder email sent successfully"
}
```

### 2. Process All Reminders
```http
POST /invite/process-reminders
Content-Type: application/json

{
  "reminderIntervalDays": 7
}
```

Manually trigger reminder processing for all pending invites.

**Response:**
```json
{
  "sent": 15,
  "failed": 0,
  "message": "Processed reminders: 15 sent, 0 failed"
}
```

### 3. Get Pending Reminders
```http
GET /invite/pending-reminders/:reminderIntervalDays?
```

Get list of invites that need reminders.

**Response:**
```json
{
  "count": 15,
  "invites": [
    {
      "id": "...",
      "email": "user@example.com",
      "lastReminderSent": null,
      "reminderCount": 0,
      "event": { ... }
    }
  ]
}
```

## Database Schema

The reminder system adds two fields to the `invites` table:

```prisma
model Invite {
  // ... existing fields
  lastReminderSent  DateTime?  // When the last reminder was sent
  reminderCount     Int        // Total reminders sent (default: 0)
}
```

## Email Template

The reminder email includes:

1. **Hero Section**
   - Event banner image
   - "⏰ Reminder: RSVP Now!" heading
   - "You haven't confirmed your attendance yet" subheading

2. **Countdown Box**
   - Gradient orange background
   - Large number showing days left
   - "Time is Running Out" message
   - Responsive sizing

3. **Event Details**
   - Event name
   - Date and time
   - Venue and address
   - Dress code
   - Event description (if provided)

4. **Call-to-Action**
   - Prominent "RSVP NOW" button
   - Unique invitation link
   - "Don't Miss Out!" banner

5. **Footer**
   - Contact information
   - Logo (mobile only)

## Testing

### Test Reminder Email

Run the test script to preview the reminder email:

```bash
cd backend-event-rsvp
node test-reminder-email.js
```

This will send a test reminder email to the configured email address.

### Manual Testing

1. Create an invite without confirming:
```bash
curl -X POST http://localhost:3001/invite/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "eventId": "your-event-id",
    "sendEmail": true
  }'
```

2. Send a reminder manually:
```bash
curl -X POST http://localhost:3001/invite/send-reminder/invite-id
```

3. Check pending reminders:
```bash
curl http://localhost:3001/invite/pending-reminders/7
```

## Scheduler Service

The scheduler service runs in the background when `ENABLE_AUTO_REMINDERS=true`.

### How It Works

1. **Startup**: Runs immediately when the server starts
2. **Interval**: Checks for pending reminders every X hours (configurable)
3. **Processing**: 
   - Finds all unused invites
   - Checks if reminder interval has passed
   - Sends reminder emails
   - Updates tracking fields

### Scheduler Status

The scheduler logs its activity:

```
[SchedulerService] Starting reminder scheduler: checking every 24 hours, sending reminders every 7 days
[SchedulerService] Processing reminder emails...
[SchedulerService] Reminder processing complete: 15 sent, 0 failed
```

## Best Practices

### 1. Reminder Frequency
- **Too frequent**: Annoys recipients (< 3 days)
- **Recommended**: 7 days between reminders
- **Too infrequent**: Recipients forget (> 14 days)

### 2. Timing
- Start reminders 2-3 weeks before event
- Stop reminders 2-3 days before event
- Check daily for pending reminders

### 3. Content
- Keep countdown prominent
- Maintain urgency without being pushy
- Include all event details
- Make RSVP button obvious

### 4. Monitoring
- Check logs for failed sends
- Monitor reminder counts per invite
- Track RSVP conversion rates
- Adjust intervals based on results

## Troubleshooting

### Reminders Not Sending

1. Check if auto-reminders are enabled:
```bash
echo $ENABLE_AUTO_REMINDERS
```

2. Verify email service is configured:
```bash
echo $RESEND_API_KEY
echo $FROM_EMAIL
```

3. Check scheduler status in logs:
```
[SchedulerService] Starting reminder scheduler...
```

### Too Many Reminders

1. Increase `REMINDER_INTERVAL_DAYS`:
```bash
REMINDER_INTERVAL_DAYS="14"
```

2. Check `reminderCount` in database:
```sql
SELECT email, reminderCount, lastReminderSent 
FROM invites 
WHERE isUsed = false;
```

### Reminders to Wrong People

1. Verify invite status:
```sql
SELECT * FROM invites WHERE email = 'user@example.com';
```

2. Check if invite was used:
```sql
UPDATE invites SET isUsed = true WHERE id = 'invite-id';
```

## Migration

To add reminder tracking to existing database:

```bash
cd backend-event-rsvp
npx prisma migrate deploy
```

Or run the migration manually:

```sql
ALTER TABLE "invites" 
ADD COLUMN "lastReminderSent" TIMESTAMP(3),
ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;
```

## Future Enhancements

Potential improvements for the reminder system:

1. **Real-time Countdown**: JavaScript-based countdown in email
2. **Multiple Reminder Templates**: Different messages for 1st, 2nd, 3rd reminders
3. **Smart Scheduling**: Send at optimal times based on recipient timezone
4. **A/B Testing**: Test different subject lines and content
5. **Reminder Preferences**: Let users choose reminder frequency
6. **SMS Reminders**: Add text message reminders
7. **Calendar Integration**: Include calendar file in reminders
8. **Waitlist Reminders**: Remind waitlisted users to check status

## Support

For questions or issues:
- Email: contact@levyeromedia.com
- Check logs: `docker logs backend-event-rsvp`
- Review documentation: `/docs` folder
