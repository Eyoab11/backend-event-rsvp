# Frontend Integration Guide

This guide explains how the frontend integrates with the backend API.

## Overview

The frontend (Next.js) communicates with the backend (NestJS) through REST API endpoints. All API calls are made to `http://localhost:3002` in development.

## Configuration

### Backend (.env)
```env
DATABASE_URL="postgresql://postgres:admin@localhost:5432/lem_ventures_events"
PORT=3002
FRONTEND_URL="http://localhost:3000"
EMAIL_API_KEY="your-resend-api-key"
FROM_EMAIL="noreply@levyeromedia.com"
```

### Frontend (.env)
```env
NEXT_PUBLIC_API_URL=http://localhost:3002
```

## API Integration Points

### 1. RSVP Page (`/rsvp?token=xxx`)

**Flow:**
1. User receives invite email with link: `http://localhost:3000/rsvp?token=frontend-test-token-123`
2. Frontend extracts token from URL
3. Validates token: `GET /api/invite/validate/:token` (includes event data)
4. Displays RSVP form with event information

**Code Location:** `LEM-Event_RSVP/app/rsvp/page.tsx`

**API Calls:**
```typescript
// Validate invite token (includes event data)
const response = await fetch(`http://localhost:3002/api/invite/validate/${token}`);
const inviteData = await response.json();

// Event data is already included in the response
const event = inviteData.invite.event;
```

### 2. RSVP Submission

**Flow:**
1. User fills out form (name, company, title, email)
2. Optionally adds plus-one
3. Confirms and submits
4. Frontend sends data to: `POST /api/rsvp/submit`
5. Backend processes registration, sends email, generates QR code
6. Redirects to success page with attendee ID

**Code Location:** `LEM-Event_RSVP/components/RSVPForm.tsx`

**API Call:**
```typescript
const response = await fetch('http://localhost:3002/api/rsvp/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: linkToken,
    name: primaryAttendee.name,
    company: primaryAttendee.company,
    title: primaryAttendee.title,
    email: primaryAttendee.email,
    plusOne: plusOne ? {
      name: plusOne.name,
      company: plusOne.company,
      title: plusOne.title,
      email: plusOne.email,
    } : undefined,
  }),
});

const result = await response.json();
// Redirect to: /rsvp/success/${result.attendee.id}
```

### 3. Success Page (`/rsvp/success/[attendeeId]`)

**Flow:**
1. Page loads with attendee ID from URL
2. Fetches registration details: `GET /api/rsvp/success/:attendeeId`
3. Displays confirmation with QR code
4. Provides calendar download button

**Code Location:** `LEM-Event_RSVP/app/rsvp/success/[attendeeId]/page.tsx`

**API Calls:**
```typescript
// Get registration details
const response = await fetch(`http://localhost:3002/api/rsvp/success/${attendeeId}`);
const data = await response.json();

// Download calendar file
window.open(`http://localhost:3002/api/calendar/attendee/${attendeeId}/download`, '_blank');
```

### 4. QR Code Display

**Flow:**
1. Component receives QR code hash from registration data
2. Validates QR code: `GET /api/qr/validate/:qrCode`
3. Fetches QR code image: `GET /api/qr/attendee/:attendeeId`
4. Displays base64 PNG image

**Code Location:** `LEM-Event_RSVP/components/QRCodeDisplay.tsx`

**API Calls:**
```typescript
// Validate QR code
const response = await fetch(`http://localhost:3002/api/qr/validate/${qrCodeData}`);
const data = await response.json();

// Get QR code image
const qrResponse = await fetch(`http://localhost:3002/api/qr/attendee/${data.attendee.id}`);
const qrData = await qrResponse.json();
// qrData.qrCode contains base64 PNG
```

## Data Flow

### Registration Flow
```
User clicks invite link
    ↓
Frontend validates token
    ↓
Frontend displays RSVP form
    ↓
User fills form and submits
    ↓
Backend creates attendee record
    ↓
Backend generates QR code
    ↓
Backend sends confirmation email
    ↓
Backend returns registration data
    ↓
Frontend redirects to success page
    ↓
Frontend displays QR code and details
```

### Email Flow
```
Backend receives RSVP submission
    ↓
Backend creates attendee in database
    ↓
Backend generates calendar .ics file
    ↓
Backend sends email with:
  - Event details
  - Registration ID
  - QR code link
  - Calendar attachment
    ↓
User receives email
```

## Testing the Integration

### 1. Create Test Invite
```sql
INSERT INTO invites (id, email, token, "isUsed", "expiresAt", "inviteType", "eventId", "createdAt")
VALUES (
  'test-invite-frontend',
  'frontend@test.com',
  'frontend-test-token-123',
  false,
  '2026-12-31',
  'VIP',
  'test-event-123',
  NOW()
);
```

### 2. Test RSVP Flow
1. Start backend: `cd backend-event-rsvp && npm run start:dev`
2. Start frontend: `cd LEM-Event_RSVP && npm run dev`
3. Open: `http://localhost:3000/rsvp?token=frontend-test-token-123`
4. Fill out form and submit
5. Verify success page displays correctly
6. Check email was sent (if EMAIL_API_KEY is configured)

### 3. Test QR Code
1. On success page, verify QR code displays
2. Click "Download QR Code" button
3. Verify PNG file downloads

### 4. Test Calendar
1. On success page, click "Add to Calendar"
2. Verify .ics file downloads
3. Open file in calendar app (Google Calendar, Apple Calendar, etc.)
4. Verify event details are correct

## API Helper Functions

The frontend includes a centralized API configuration file:

**Location:** `LEM-Event_RSVP/lib/api.ts`

**Usage:**
```typescript
import { API_ENDPOINTS, apiCall } from '@/lib/api';

// Validate invite
const inviteData = await apiCall(API_ENDPOINTS.validateInvite(token));

// Submit RSVP
const result = await apiCall(API_ENDPOINTS.submitRSVP(), {
  method: 'POST',
  body: JSON.stringify(rsvpData),
});
```

## Error Handling

### Frontend Error Handling
- Invalid token: Shows error page with message
- Network errors: Displays user-friendly error message
- Validation errors: Shows inline form errors

### Backend Error Responses
```typescript
// Success response
{
  attendee: { ... },
  event: { ... },
  isWaitlisted: false
}

// Error response
{
  statusCode: 400,
  message: "This invite has already been used",
  error: "Bad Request"
}
```

## CORS Configuration

The backend is configured to accept requests from the frontend:

```typescript
// backend-event-rsvp/src/main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
});
```

## Production Deployment

### Environment Variables

**Backend:**
- `DATABASE_URL`: Production PostgreSQL connection string
- `FRONTEND_URL`: Production frontend URL (e.g., `https://events.levyeromedia.com`)
- `EMAIL_API_KEY`: Resend API key
- `FROM_EMAIL`: Verified sender email

**Frontend:**
- `NEXT_PUBLIC_API_URL`: Production backend URL (e.g., `https://api.levyeromedia.com`)

### Deployment Checklist
- [ ] Update CORS origin to production frontend URL
- [ ] Configure production database
- [ ] Set up email service with verified domain
- [ ] Test full RSVP flow in production
- [ ] Verify emails are delivered
- [ ] Test QR code generation and validation
- [ ] Test calendar file downloads

## Troubleshooting

### Issue: "Invalid invitation token"
- Check token exists in database
- Verify token hasn't been used (`isUsed = false`)
- Check token hasn't expired

### Issue: "Failed to fetch event details"
- Verify backend is running on port 3002
- Check event exists in database
- Verify CORS is configured correctly

### Issue: QR code not displaying
- Check attendee ID is valid
- Verify QR code was generated during registration
- Check browser console for errors

### Issue: Email not received
- Verify `EMAIL_API_KEY` is set
- Check Resend dashboard for delivery status
- Verify sender email is verified in Resend
- Check spam folder
