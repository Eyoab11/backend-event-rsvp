import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { Event, Attendee, PlusOne, AttendeeStatus } from '@prisma/client';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    // Set environment variables for testing
    process.env.EMAIL_API_KEY = 'test-api-key';
    process.env.FROM_EMAIL = 'test@example.com';
    process.env.FRONTEND_URL = 'http://localhost:3000';

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    delete process.env.EMAIL_API_KEY;
    delete process.env.FROM_EMAIL;
    delete process.env.FRONTEND_URL;
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize without API key', () => {
      delete process.env.EMAIL_API_KEY;
      const module = Test.createTestingModule({
        providers: [EmailService],
      });
      expect(module).toBeDefined();
    });
  });

  describe('sendConfirmationEmail', () => {
    it('should handle missing email service gracefully', async () => {
      // Create service without API key
      delete process.env.EMAIL_API_KEY;
      const module = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      const serviceWithoutKey = module.get<EmailService>(EmailService);

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

      // Should not throw error
      await expect(
        serviceWithoutKey.sendConfirmationEmail({
          event: mockEvent,
          attendee: mockAttendee,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendWaitlistEmail', () => {
    it('should handle missing email service gracefully', async () => {
      // Create service without API key
      delete process.env.EMAIL_API_KEY;
      const module = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      const serviceWithoutKey = module.get<EmailService>(EmailService);

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
        status: AttendeeStatus.WAITLISTED,
        qrCode: 'qr123',
        registrationId: 'REG-12345678',
        inviteId: 'invite-1',
        eventId: 'event-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Should not throw error
      await expect(
        serviceWithoutKey.sendWaitlistEmail({
          event: mockEvent,
          attendee: mockAttendee,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('email content generation', () => {
    it('should generate confirmation email with all required fields', () => {
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

      // Access private method through any type for testing
      const htmlContent = (service as any).generateConfirmationEmailHtml({
        event: mockEvent,
        attendee: mockAttendee,
      });

      expect(htmlContent).toContain('Test Event');
      expect(htmlContent).toContain('John Doe');
      expect(htmlContent).toContain('REG-12345678');
      expect(htmlContent).toContain('Test Venue');
      expect(htmlContent).toContain('Business Casual');
    });

    it('should generate waitlist email with all required fields', () => {
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
        status: AttendeeStatus.WAITLISTED,
        qrCode: 'qr123',
        registrationId: 'REG-12345678',
        inviteId: 'invite-1',
        eventId: 'event-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const htmlContent = (service as any).generateWaitlistEmailHtml({
        event: mockEvent,
        attendee: mockAttendee,
      });

      expect(htmlContent).toContain('Waitlist');
      expect(htmlContent).toContain('Test Event');
      expect(htmlContent).toContain('John Doe');
      expect(htmlContent).toContain('REG-12345678');
    });
  });
});
