import { Test, TestingModule } from '@nestjs/testing';
import { RsvpService } from './rsvp.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InviteService } from '../invite/invite.service';
import { AttendeeStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('RsvpService', () => {
  let service: RsvpService;
  let prismaService: PrismaService;
  let inviteService: InviteService;

  const mockPrismaService = {
    attendee: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    plusOne: {
      create: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    invite: {
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockInviteService = {
    validateToken: jest.fn(),
    markTokenAsUsed: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RsvpService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: InviteService,
          useValue: mockInviteService,
        },
      ],
    }).compile();

    service = module.get<RsvpService>(RsvpService);
    prismaService = module.get<PrismaService>(PrismaService);
    inviteService = module.get<InviteService>(InviteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkCapacity', () => {
    it('should return true when capacity is available', async () => {
      const mockEvent = {
        id: 'event-1',
        capacity: 100,
        currentRegistrations: 50,
      };

      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);

      const result = await service.checkCapacity('event-1', false);

      expect(result).toBe(true);
    });

    it('should return false when capacity is exceeded', async () => {
      const mockEvent = {
        id: 'event-1',
        capacity: 100,
        currentRegistrations: 100,
      };

      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);

      const result = await service.checkCapacity('event-1', false);

      expect(result).toBe(false);
    });

    it('should account for plus-one when checking capacity', async () => {
      const mockEvent = {
        id: 'event-1',
        capacity: 100,
        currentRegistrations: 99,
      };

      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);

      const result = await service.checkCapacity('event-1', true);

      expect(result).toBe(false); // Need 2 slots but only 1 available
    });

    it('should throw BadRequestException when event not found', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.checkCapacity('invalid-event', false)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('submitRsvp', () => {
    const mockInvite = {
      id: 'invite-1',
      email: 'test@example.com',
      token: 'valid-token',
      isUsed: false,
      expiresAt: new Date(Date.now() + 86400000),
      eventId: 'event-1',
      event: {
        id: 'event-1',
        eventName: 'Test Event',
        capacity: 100,
        currentRegistrations: 50,
        registrationOpen: true,
        eventDate: new Date(),
        eventStartTime: '19:00',
        eventEndTime: '23:00',
        venueName: 'Test Venue',
        venueAddress: '123 Test St',
        venueCity: 'Test City',
        venueState: 'TS',
        venueZipCode: '12345',
        dressCode: 'Casual',
        description: 'Test event',
      },
    };

    it('should create confirmed attendee when capacity is available', async () => {
      const rsvpData = {
        name: 'John Doe',
        company: 'Test Corp',
        title: 'Developer',
        email: 'john@test.com',
        token: 'valid-token',
      };

      const mockAttendee = {
        id: 'attendee-1',
        ...rsvpData,
        status: AttendeeStatus.CONFIRMED,
        registrationId: 'REG-12345678',
        qrCode: 'qr-code',
        inviteId: 'invite-1',
        eventId: 'event-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInviteService.validateToken.mockResolvedValue(mockInvite);
      mockPrismaService.event.findUnique.mockResolvedValue(mockInvite.event);
      mockPrismaService.attendee.create.mockResolvedValue(mockAttendee);

      const result = await service.submitRsvp(rsvpData);

      expect(result.attendee.status).toBe(AttendeeStatus.CONFIRMED);
      expect(result.isWaitlisted).toBe(false);
      expect(mockInviteService.validateToken).toHaveBeenCalledWith('valid-token');
    });

    it('should create waitlisted attendee when capacity is exceeded', async () => {
      const rsvpData = {
        name: 'John Doe',
        company: 'Test Corp',
        title: 'Developer',
        email: 'john@test.com',
        token: 'valid-token',
      };

      const fullEvent = {
        ...mockInvite.event,
        capacity: 100,
        currentRegistrations: 100,
      };

      const mockAttendee = {
        id: 'attendee-1',
        ...rsvpData,
        status: AttendeeStatus.WAITLISTED,
        registrationId: 'REG-12345678',
        qrCode: 'qr-code',
        inviteId: 'invite-1',
        eventId: 'event-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInviteService.validateToken.mockResolvedValue({
        ...mockInvite,
        event: fullEvent,
      });
      mockPrismaService.event.findUnique.mockResolvedValue(fullEvent);
      mockPrismaService.attendee.create.mockResolvedValue(mockAttendee);

      const result = await service.submitRsvp(rsvpData);

      expect(result.attendee.status).toBe(AttendeeStatus.WAITLISTED);
      expect(result.isWaitlisted).toBe(true);
    });
  });
});
