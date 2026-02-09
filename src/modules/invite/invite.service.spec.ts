import { Test, TestingModule } from '@nestjs/testing';
import { InviteService } from './invite.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('InviteService', () => {
  let service: InviteService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    invite: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<InviteService>(InviteService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateInvite', () => {
    it('should generate a new invite with UUID token', async () => {
      const mockInvite = {
        id: 'test-id',
        email: 'test@example.com',
        token: 'uuid-token',
        isUsed: false,
        expiresAt: new Date(),
        eventId: 'event-id',
        createdAt: new Date(),
      };

      mockPrismaService.invite.create.mockResolvedValue(mockInvite);

      const result = await service.generateInvite('test@example.com', 'event-id');

      expect(result).toEqual(mockInvite);
      expect(mockPrismaService.invite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          eventId: 'event-id',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });
  });

  describe('validateToken', () => {
    it('should return invite for valid token', async () => {
      const mockInvite = {
        id: 'test-id',
        email: 'test@example.com',
        token: 'valid-token',
        isUsed: false,
        expiresAt: new Date(Date.now() + 86400000), // 1 day from now
        eventId: 'event-id',
        createdAt: new Date(),
        event: { id: 'event-id', eventName: 'Test Event' },
      };

      mockPrismaService.invite.findUnique.mockResolvedValue(mockInvite);

      const result = await service.validateToken('valid-token');

      expect(result).toEqual(mockInvite);
    });

    it('should throw NotFoundException for invalid token', async () => {
      mockPrismaService.invite.findUnique.mockResolvedValue(null);

      await expect(service.validateToken('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for used token', async () => {
      const mockInvite = {
        id: 'test-id',
        isUsed: true,
        expiresAt: new Date(Date.now() + 86400000),
      };

      mockPrismaService.invite.findUnique.mockResolvedValue(mockInvite);

      await expect(service.validateToken('used-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for expired token', async () => {
      const mockInvite = {
        id: 'test-id',
        isUsed: false,
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
      };

      mockPrismaService.invite.findUnique.mockResolvedValue(mockInvite);

      await expect(service.validateToken('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
