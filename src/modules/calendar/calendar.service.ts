import { Injectable } from '@nestjs/common';
import { createEvents, EventAttributes, DateArray } from 'ics';
import { Event, Attendee } from '@prisma/client';

export interface CalendarEventData {
  event: Event;
  attendee: Attendee;
}

@Injectable()
export class CalendarService {
  /**
   * Generate an ICS calendar file for an attendee
   * Compatible with Google Calendar, Apple Calendar, Outlook, etc.
   */
  generateCalendarFile(data: CalendarEventData): string {
    const { event, attendee } = data;

    // Parse event date and times
    const eventDate = new Date(event.eventDate);
    const [startHour, startMinute] = event.eventStartTime.split(':').map(Number);
    const [endHour, endMinute] = event.eventEndTime.split(':').map(Number);

    // Create start and end date arrays for ICS format [year, month, day, hour, minute]
    const start: DateArray = [
      eventDate.getFullYear(),
      eventDate.getMonth() + 1, // ICS months are 1-indexed
      eventDate.getDate(),
      startHour,
      startMinute,
    ];

    const end: DateArray = [
      eventDate.getFullYear(),
      eventDate.getMonth() + 1,
      eventDate.getDate(),
      endHour,
      endMinute,
    ];

    // Build event description
    const description = [
      event.description || '',
      '',
      `Registration ID: ${attendee.registrationId}`,
      `Dress Code: ${event.dressCode}`,
      '',
      'Please bring your QR code for check-in.',
    ].join('\n');

    // Build location string
    const location = [
      event.venueName,
      event.venueAddress,
      `${event.venueCity}, ${event.venueState} ${event.venueZipCode}`,
    ].join(', ');

    // Create ICS event
    const icsEvent: EventAttributes = {
      start,
      end,
      title: event.eventName,
      description,
      location,
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      organizer: {
        name: 'LEM Ventures',
        email: 'events@levyeromedia.com',
      },
      attendees: [
        {
          name: attendee.name,
          email: attendee.email,
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

    // Add coordinates if available
    if (event.venueLatitude && event.venueLongitude) {
      icsEvent.geo = {
        lat: event.venueLatitude,
        lon: event.venueLongitude,
      };
    }

    // Generate ICS file
    const { error, value } = createEvents([icsEvent]);

    if (error) {
      throw new Error(`Failed to generate calendar file: ${error.message}`);
    }

    return value || '';
  }

  /**
   * Generate a filename for the calendar file
   */
  generateFilename(eventName: string, attendeeName: string): string {
    const sanitize = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    return `${sanitize(eventName)}-${sanitize(attendeeName)}.ics`;
  }
}
