import { Test, TestingModule } from '@nestjs/testing';
import { QrService } from './qr.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { AttendeeStatus } from '@prisma/client';

describe('QrService', () => {
  let service: QrService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    attendee: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QrService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<QrService>(QrService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateQrCode', () => {
    it('should return attendee for valid QR code', async () => {
      const mockAttendee = {
        id: 'attendee-1',
        name: 'John Doe',
        company: 'Test Corp',
        title: 'Developer',
        email: 'john@test.com',
        status: AttendeeStatus.CONFIRMED,
        qrCode: 'valid-qr-code',
        registrationId: 'REG-12345678',
        inviteId: 'invite-1',
        eventId: 'event-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        event: { id: 'event-1', eventName: 'Test Event' },
        plusOne: null,
        invite: { id: 'invite-1' },
      };

      mockPrismaService.attendee.findUnique.mockResolvedValue(mockAttendee);

      const result = await service.validateQrCode('valid-qr-code');

      expect(result).toEqual(mockAttendee);
      expect(mockPrismaService.attendee.findUnique).toHaveBeenCalledWith({
        where: { qrCode: 'valid-qr-code' },
        include: {
          event: true,
          plusOne: true,
          invite: true,
        },
      });
    });

    it('should throw NotFoundException for invalid QR code', async () => {
      mockPrismaService.attendee.findUnique.mockResolvedValue(null);

      await expect(service.validateQrCode('invalid-qr-code')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generateQrCodeImage', () => {
    it('should generate QR code image as data URL', async () => {
      const result = await service.generateQrCodeImage('test-data');

      expect(result).toMatch(/^data:image\/png;base64,/);
    });

    it('should throw error for invalid data', async () => {
      await expect(service.generateQrCodeImage(null)).rejects.toThrow();
    });
  });

  describe('getAttendeeQrCode', () => {
    it('should return QR code and image for valid attendee', async () => {
      const mockAttendee = {
        id: 'attendee-1',
        name: 'John Doe',
        qrCode: 'test-qr-code',
        event: { id: 'event-1' },
        plusOne: null,
      };

      mockPrismaService.attendee.findUnique.mockResolvedValue(mockAttendee);

      const result = await service.getAttendeeQrCode('attendee-1');

      expect(result.qrCode).toBe('test-qr-code');
      expect(result.qrCodeImage).toMatch(/^data:image\/png;base64,/);
      expect(result.attendee).toEqual(mockAttendee);
    });

    it('should throw NotFoundException for invalid attendee', async () => {
      mockPrismaService.attendee.findUnique.mockResolvedValue(null);

      await expect(service.getAttendeeQrCode('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
