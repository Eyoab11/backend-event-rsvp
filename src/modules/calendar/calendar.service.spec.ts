import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { Event, Attendee, AttendeeStatus } from '@prisma/client';

describe('CalendarService', () => {
  let service: CalendarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CalendarService],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  describe('generateCalendarFile', () => {
    it('should generate valid ICS content', () => {
      const mockEvent: Event = {
        id: 'event-1',
        eventName: 'Test Event',
        description: 'A test event',
        eventDate: new Date('2026-03-15'),
        eventStartTime: '18:00',
        eventEndTime: '22:00',
        venueName: 'Test Venue',
        venueAddress: '123 Test St',
        venueCity: 'Los Angeles',
        venueState: 'CA',
        venueZipCode: '90001',
        venueLatitude: 34.05,
        venueLongitude: -118.25,
        capacity: 100,
        currentRegistrations: 10,
        waitlistEnabled: true,
        registrationOpen: true,
        dressCode: 'Business Casual',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAttendee: Attendee = {
        id: 'attendee-1',
        name: 'John Doe',
        company: 'Test Corp',
        title: 'Developer',
        email: 'john@test.com',
        status: AttendeeStatus.CONFIRMED,
        qrCode: 'qr123',
        registrationId: 'REG-12345678',
        inviteId: 'invite-1',
        eventId: 'event-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.generateCalendarFile({
        event: mockEvent,
        attendee: mockAttendee,
      });

      // Verify ICS structure
      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('END:VCALENDAR');
      expect(result).toContain('BEGIN:VEVENT');
      expect(result).toContain('END:VEVENT');

      // Verify event details
      expect(result).toContain('SUMMARY:Test Event');
      expect(result).toContain('LOCATION:Test Venue');
      expect(result).toContain('DESCRIPTION:');
      expect(result).toContain('REG-12345678');
      expect(result).toContain('Dress Code');

      // Verify attendee
      expect(result).toContain('John Doe');
      expect(result).toContain('john@test.com');

      // Verify organizer
      expect(result).toContain('LEM Ventures');
      expect(result).toContain('events@levyeromedia.com');

      // Verify alarms/reminders
      expect(result).toContain('BEGIN:VALARM');
      expect(result).toContain('TRIGGER:-PT24H');
      expect(result).toContain('TRIGGER:-PT1H');

      // Verify geo coordinates
      expect(result).toContain('GEO:34.05;-118.25');
    });

    it('should handle events without coordinates', () => {
      const mockEvent: Event = {
        id: 'event-1',
        eventName: 'Test Event',
        description: 'A test event',
        eventDate: new Date('2026-03-15'),
        eventStartTime: '18:00',
        eventEndTime: '22:00',
        venueName: 'Test Venue',
        venueAddress: '123 Test St',
        venueCity: 'Los Angeles',
        venueState: 'CA',
        venueZipCode: '90001',
        venueLatitude: null,
        venueLongitude: null,
        capacity: 100,
        currentRegistrations: 10,
        waitlistEnabled: true,
        registrationOpen: true,
        dressCode: 'Business Casual',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAttendee: Attendee = {
        id: 'attendee-1',
        name: 'John Doe',
        company: 'Test Corp',
        title: 'Developer',
        email: 'john@test.com',
        status: AttendeeStatus.CONFIRMED,
        qrCode: 'qr123',
        registrationId: 'REG-12345678',
        inviteId: 'invite-1',
        eventId: 'event-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.generateCalendarFile({
        event: mockEvent,
        attendee: mockAttendee,
      });

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).not.toContain('GEO:');
    });

    it('should handle events without description', () => {
      const mockEvent: Event = {
        id: 'event-1',
        eventName: 'Test Event',
        description: null,
        eventDate: new Date('2026-03-15'),
        eventStartTime: '18:00',
        eventEndTime: '22:00',
        venueName: 'Test Venue',
        venueAddress: '123 Test St',
        venueCity: 'Los Angeles',
        venueState: 'CA',
        venueZipCode: '90001',
        venueLatitude: null,
        venueLongitude: null,
        capacity: 100,
        currentRegistrations: 10,
        waitlistEnabled: true,
        registrationOpen: true,
        dressCode: 'Business Casual',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAttendee: Attendee = {
        id: 'attendee-1',
        name: 'John Doe',
        company: 'Test Corp',
        title: 'Developer',
        email: 'john@test.com',
        status: AttendeeStatus.CONFIRMED,
        qrCode: 'qr123',
        registrationId: 'REG-12345678',
        inviteId: 'invite-1',
        eventId: 'event-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = service.generateCalendarFile({
        event: mockEvent,
        attendee: mockAttendee,
      });

      expect(result).toContain('BEGIN:VCALENDAR');
      expect(result).toContain('REG-12345678');
    });
  });

  describe('generateFilename', () => {
    it('should generate sanitized filename', () => {
      const result = service.generateFilename(
        'LEM Ventures Launch Event',
        'John Doe',
      );

      expect(result).toBe('lem-ventures-launch-event-john-doe.ics');
    });

    it('should handle special characters', () => {
      const result = service.generateFilename(
        'Event @ The Ritz!',
        "O'Brien & Associates",
      );

      expect(result).toBe('event-the-ritz-o-brien-associates.ics');
    });

    it('should handle multiple spaces and dashes', () => {
      const result = service.generateFilename(
        'Test   Event---Name',
        'User  Name',
      );

      expect(result).toBe('test-event-name-user-name.ics');
    });
  });
});
