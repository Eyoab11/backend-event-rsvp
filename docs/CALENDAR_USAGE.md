# Calendar Module Usage

The Calendar module generates `.ics` (iCalendar) files that work with Google Calendar, Apple Calendar, Outlook, and all other calendar applications.

## Endpoints

### Get Calendar Data (JSON)
```
GET /api/calendar/attendee/:attendeeId
```

Returns JSON with calendar content and filename.

**Response:**
```json
{
  "content": "BEGIN:VCALENDAR\n...",
  "filename": "event-name-attendee-name.ics"
}
```

### Download Calendar File
```
GET /api/calendar/attendee/:attendeeId/download
```

Returns raw `.ics` file for direct download.

**Headers:**
- `Content-Type: text/calendar; charset=utf-8`

## Features

### Event Details
- Event name, description, date, and time
- Venue name and full address
- Geographic coordinates (if available)
- Dress code
- Registration ID

### Attendee Information
- Attendee name and email
- RSVP status set to "ACCEPTED"
- Participant role

### Reminders
- 24 hours before event
- 1 hour before event

### Organizer
- Name: LEM Ventures
- Email: events@levyeromedia.com

## Usage in Frontend

### Direct Download Link
```html
<a href="http://localhost:3002/api/calendar/attendee/{attendeeId}/download" download>
  Add to Calendar
</a>
```

### Fetch and Process
```javascript
const response = await fetch(`/api/calendar/attendee/${attendeeId}`);
const { content, filename } = await response.json();

// Create blob and download
const blob = new Blob([content], { type: 'text/calendar' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = filename;
a.click();
```

## Integration with Email

The calendar service can be integrated with the email module to attach `.ics` files to confirmation emails:

```typescript
import { CalendarService } from './modules/calendar/calendar.service';

// In your email service
const icsContent = this.calendarService.generateCalendarFile({
  event,
  attendee,
});

// Attach to email
await this.sendEmail({
  to: attendee.email,
  subject: 'Event Confirmation',
  attachments: [
    {
      filename: this.calendarService.generateFilename(event.eventName, attendee.name),
      content: icsContent,
      contentType: 'text/calendar',
    },
  ],
});
```

## Testing

The calendar file can be tested by:
1. Downloading the `.ics` file
2. Opening it with any calendar application
3. Verifying all event details are correct
4. Checking that reminders are set properly

## Compatibility

The generated `.ics` files are compatible with:
- Google Calendar
- Apple Calendar (macOS, iOS)
- Microsoft Outlook
- Mozilla Thunderbird
- Any RFC 5545 compliant calendar application
