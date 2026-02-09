import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { AttendeeStatus } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  const mockPrismaService = {
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    attendee: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAttendees', () => {
    it('should return attendees for a valid event', async () => {
      const mockEvent = { id: 'event-1', eventName: 'Test Event' };
      const mockAttendees = [
        {
          id: 'attendee-1',
          name: 'John Doe',
          email: 'john@test.com',
          company: 'Test Co',
          title: 'Developer',
          status: AttendeeStatus.CONFIRMED,
          plusOne: { name: 'Jane Doe', email: 'jane@test.com' },
          invite: {},
        },
      ];

      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.attendee.findMany.mockResolvedValue(mockAttendees);

      const result = await service.getAttendees('event-1');

      expect(result).toEqual(mockAttendees);
      expect(prisma.event.findUnique).toHaveBeenCalledWith({
        where: { id: 'event-1' },
      });
      expect(prisma.attendee.findMany).toHaveBeenCalledWith({
        where: { eventId: 'event-1' },
        include: {
          plusOne: true,
          invite: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    });

    it('should throw NotFoundException for invalid event', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.getAttendees('invalid-event')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getEventStats', () => {
    it('should return correct event statistics', async () => {
      const mockEvent = {
        id: 'event-1',
        capacity: 100,
        currentRegistrations: 10,
        attendees: [
          {
            status: AttendeeStatus.CONFIRMED,
            plusOne: { name: 'Plus One' },
          },
          {
            status: AttendeeStatus.CONFIRMED,
            plusOne: null,
          },
          {
            status: AttendeeStatus.WAITLISTED,
            plusOne: null,
          },
        ],
        invites: [
          { isUsed: true, expiresAt: new Date('2030-01-01') },
          { isUsed: false, expiresAt: new Date('2020-01-01') },
          { isUsed: false, expiresAt: new Date('2030-01-01') },
        ],
      };

      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);

      const result = await service.getEventStats('event-1');

      expect(result).toEqual({
        totalCapacity: 100,
        currentRegistrations: 10,
        availableSlots: 90,
        confirmedAttendees: 2,
        waitlistedAttendees: 1,
        cancelledAttendees: 0,
        attendeesWithPlusOne: 1,
        totalPlusOnes: 1,
        inviteStats: {
          total: 3,
          used: 1,
          unused: 2,
          expired: 1,
        },
      });
    });

    it('should throw NotFoundException for invalid event', async () => {
      mockPrismaService.event.findUnique.mockResolvedValue(null);

      await expect(service.getEventStats('invalid-event')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('exportAttendees', () => {
    it('should generate CSV with attendee data', async () => {
      const mockEvent = { id: 'event-1' };
      const mockAttendees = [
        {
          registrationId: 'REG-123',
          name: 'John Doe',
          company: 'Test Co',
          title: 'Developer',
          email: 'john@test.com',
          status: AttendeeStatus.CONFIRMED,
          qrCode: 'qr123',
          createdAt: new Date('2024-01-01'),
          invite: {},
          plusOne: {
            name: 'Jane Doe',
            company: 'Test Co',
            title: 'Designer',
            email: 'jane@test.com',
          },
        },
      ];

      mockPrismaService.event.findUnique.mockResolvedValue(mockEvent);
      mockPrismaService.attendee.findMany.mockResolvedValue(mockAttendees);

      const result = await service.exportAttendees('event-1');

      expect(result).toContain('Registration ID,Name,Company');
      expect(result).toContain('REG-123');
      expect(result).toContain('John Doe');
      expect(result).toContain('jane@test.com');
    });
  });

  describe('cancelAttendee', () => {
    it('should cancel confirmed attendee and free capacity', async () => {
      const mockAttendee = {
        id: 'attendee-1',
        status: AttendeeStatus.CONFIRMED,
        eventId: 'event-1',
        plusOne: null,
      };

      mockPrismaService.attendee.findUnique.mockResolvedValue(mockAttendee);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          attendee: {
            update: jest.fn(),
          },
          event: {
            update: jest.fn(),
          },
        });
      });

      await service.cancelAttendee('attendee-1');

      expect(prisma.attendee.findUnique).toHaveBeenCalledWith({
        where: { id: 'attendee-1' },
        include: { plusOne: true },
      });
    });

    it('should throw NotFoundException for invalid attendee', async () => {
      mockPrismaService.attendee.findUnique.mockResolvedValue(null);

      await expect(service.cancelAttendee('invalid-attendee')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if attendee already cancelled', async () => {
      const mockAttendee = {
        id: 'attendee-1',
        status: AttendeeStatus.CANCELLED,
        eventId: 'event-1',
        plusOne: null,
      };

      mockPrismaService.attendee.findUnique.mockResolvedValue(mockAttendee);

      await expect(service.cancelAttendee('attendee-1')).rejects.toThrow(
        'Attendee is already cancelled',
      );
    });
  });
});
