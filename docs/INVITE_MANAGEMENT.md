# Invite Management Guide

This guide explains how to create and send RSVP invitations to your guests.

## Overview

The invite system allows you to:
1. Create individual invites for specific people
2. Bulk create invites from a list
3. Automatically send invitation emails with RSVP links
4. Track invite status (unused, used, expired)
5. Resend invitations if needed

## How It Works

### 1. Create Invites
When you create an invite, the system:
- Generates a unique, secure token (UUID)
- Sets an expiration date (30 days by default)
- Stores the invite in the database
- Optionally sends an invitation email with the RSVP link

### 2. Send Invitation Emails
The invitation email includes:
- Event details (name, date, time, venue, dress code)
- Personalized RSVP link with unique token
- Invitation type (VIP, PARTNER, or GENERAL)
- Expiration date
- Beautiful HTML design

### 3. Guest RSVPs
When a guest clicks the link:
- They're taken to the RSVP page with their token
- The token is validated automatically
- They fill out the registration form
- The token is marked as "used" after submission

## API Endpoints

### Create Single Invite

**Endpoint:** `POST /api/invite/create`

**Request Body:**
```json
{
  "email": "john@example.com",
  "eventId": "test-event-123",
  "inviteType": "VIP",
  "sendEmail": true
}
```

**Response:**
```json
{
  "id": "invite-id-123",
  "email": "john@example.com",
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "isUsed": false,
  "expiresAt": "2026-03-07T00:00:00.000Z",
  "inviteType": "VIP",
  "eventId": "test-event-123",
  "createdAt": "2026-02-05T00:00:00.000Z"
}
```

**Invite Types:**
- `VIP` - VIP guests
- `PARTNER` - Business partners
- `GENERAL` - General attendees

**Example using curl:**
```bash
curl -X POST http://localhost:3002/api/invite/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "eventId": "test-event-123",
    "inviteType": "VIP",
    "sendEmail": true
  }'
```

### Bulk Create Invites

**Endpoint:** `POST /api/invite/bulk-create`

**Request Body:**
```json
{
  "eventId": "test-event-123",
  "sendEmails": true,
  "invites": [
    {
      "email": "john@example.com",
      "inviteType": "VIP"
    },
    {
      "email": "jane@example.com",
      "inviteType": "PARTNER"
    },
    {
      "email": "bob@example.com",
      "inviteType": "GENERAL"
    }
  ]
}
```

**Response:**
```json
{
  "created": 3,
  "failed": 0,
  "invites": [
    { "id": "...", "email": "john@example.com", "token": "...", ... },
    { "id": "...", "email": "jane@example.com", "token": "...", ... },
    { "id": "...", "email": "bob@example.com", "token": "...", ... }
  ]
}
```

**Example using curl:**
```bash
curl -X POST http://localhost:3002/api/invite/bulk-create \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "test-event-123",
    "sendEmails": true,
    "invites": [
      {"email": "john@example.com", "inviteType": "VIP"},
      {"email": "jane@example.com", "inviteType": "PARTNER"}
    ]
  }'
```

### Get All Invites for an Event

**Endpoint:** `GET /api/invite/event/:eventId`

**Example:**
```bash
curl http://localhost:3002/api/invite/event/test-event-123
```

**Response:**
```json
[
  {
    "id": "invite-1",
    "email": "john@example.com",
    "token": "550e8400-e29b-41d4-a716-446655440000",
    "isUsed": false,
    "expiresAt": "2026-03-07T00:00:00.000Z",
    "inviteType": "VIP",
    "eventId": "test-event-123",
    "createdAt": "2026-02-05T00:00:00.000Z"
  },
  ...
]
```

### Resend Invitation Email

**Endpoint:** `POST /api/invite/resend/:inviteId`

**Example:**
```bash
curl -X POST http://localhost:3002/api/invite/resend/invite-id-123
```

**Response:**
```json
{
  "message": "Invitation email resent successfully"
}
```

## Practical Examples

### Example 1: Create and Send Single Invite

```typescript
// Using fetch in JavaScript/TypeScript
const response = await fetch('http://localhost:3002/api/invite/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'vip@example.com',
    eventId: 'test-event-123',
    inviteType: 'VIP',
    sendEmail: true,
  }),
});

const invite = await response.json();
console.log('Invite created:', invite);
console.log('RSVP Link:', `http://localhost:3000/rsvp?token=${invite.token}`);
```

### Example 2: Import from CSV and Send Invites

```typescript
// Read CSV file with guest list
const guests = [
  { email: 'john@example.com', type: 'VIP' },
  { email: 'jane@example.com', type: 'PARTNER' },
  { email: 'bob@example.com', type: 'GENERAL' },
];

// Bulk create invites
const response = await fetch('http://localhost:3002/api/invite/bulk-create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    eventId: 'test-event-123',
    sendEmails: true,
    invites: guests.map(g => ({
      email: g.email,
      inviteType: g.type,
    })),
  }),
});

const result = await response.json();
console.log(`Created ${result.created} invites, ${result.failed} failed`);
```

### Example 3: Create Invites Without Sending Emails

```typescript
// Create invites but don't send emails yet
const response = await fetch('http://localhost:3002/api/invite/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'guest@example.com',
    eventId: 'test-event-123',
    inviteType: 'GENERAL',
    sendEmail: false, // Don't send email yet
  }),
});

const invite = await response.json();

// Later, resend the invitation
await fetch(`http://localhost:3002/api/invite/resend/${invite.id}`, {
  method: 'POST',
});
```

## Email Configuration

To send invitation emails, configure these environment variables:

```env
BREVO_SMTP_KEY="your-brevo-smtp-key"
FROM_EMAIL="noreply@levyeromedia.com"
FRONTEND_URL="http://localhost:3000"
```

### Getting a Brevo SMTP Key

1. Sign up at [brevo.com](https://www.brevo.com) (formerly Sendinblue)
2. Go to SMTP & API settings
3. Create an SMTP key
4. Add it to your `.env` file as `BREVO_SMTP_KEY`

**Note:** Brevo uses SMTP relay at `smtp-relay.brevo.com:587`

## Invitation Email Template

The invitation email includes:

**Header:**
- Purple gradient background
- "You're Invited!" title

**Event Details:**
- Event name
- Date and time
- Venue and address
- Dress code

**Invitation Info:**
- Invitation type (VIP/PARTNER/GENERAL)
- Security notice (don't share link)

**Call to Action:**
- Large "RSVP Now" button with unique link

**Footer:**
- Expiration date
- Contact information

## Tracking Invites

### Check Invite Status

```bash
# Get all invites for an event
curl http://localhost:3002/api/invite/event/test-event-123
```

The response shows:
- `isUsed: false` - Invite not yet used
- `isUsed: true` - Guest has registered
- `expiresAt` - When the invite expires

### Monitor RSVP Progress

```bash
# Get event stats including invite usage
curl http://localhost:3002/api/admin/events/test-event-123/stats
```

## Best Practices

### 1. Send Invites in Batches
Don't send all invites at once. Send in batches to:
- Monitor email delivery
- Handle any issues before sending to everyone
- Avoid email service rate limits

### 2. Test First
Always test with a few invites before sending to your full guest list:
```bash
# Create test invite
curl -X POST http://localhost:3002/api/invite/create \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test-email@example.com",
    "eventId": "test-event-123",
    "inviteType": "VIP",
    "sendEmail": true
  }'
```

### 3. Use Appropriate Invite Types
- **VIP**: High-priority guests, special treatment
- **PARTNER**: Business partners, sponsors
- **GENERAL**: Regular attendees

### 4. Set Realistic Expiration
Default is 30 days. Adjust if needed by modifying the service.

### 5. Keep Track of Invites
Export the invite list regularly:
```bash
curl http://localhost:3002/api/invite/event/test-event-123 > invites.json
```

## Troubleshooting

### Issue: Emails Not Sending
- Check `EMAIL_API_KEY` is set in `.env`
- Verify sender email is verified in Resend
- Check Resend dashboard for delivery status

### Issue: Duplicate Invites
The system prevents duplicate invites for the same email and event. If you try to create a duplicate, you'll get an error.

### Issue: Expired Invites
Invites expire after 30 days. To extend:
1. Create a new invite for the same email
2. The old invite will remain but the new one will work

### Issue: Guest Didn't Receive Email
1. Check spam folder
2. Verify email address is correct
3. Resend the invitation:
```bash
curl -X POST http://localhost:3002/api/invite/resend/invite-id-123
```

## Security

- Each invite has a unique, secure UUID token
- Tokens are single-use (marked as used after RSVP)
- Tokens expire after 30 days
- Invitation emails warn not to share links
- Backend validates tokens before allowing RSVP

## Next Steps

After creating invites:
1. Monitor RSVP submissions in admin dashboard
2. Track capacity and waitlist
3. Send reminder emails closer to event date
4. Export attendee list for check-in
