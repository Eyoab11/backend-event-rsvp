import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateSponsorDto } from '../dto/create-sponsor.dto';
import { ActivityLogService } from './activity-log.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SponsorService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  // Get active sponsors (public)
  async getActiveSponsors() {
    const sponsors = await this.prisma.sponsor.findMany({
      where: {
        isActive: true,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        tier: true,
        companyName: true,
        logoUrl: true,
        websiteUrl: true,
        description: true,
        displayOrder: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    return { sponsors };
  }

  // List all sponsors (admin)
  async listSponsors(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, search, page = 1, limit = 20 } = params;

    const where: Prisma.SponsorWhereInput = {};

    if (status) {
      where.status = status as any;
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [sponsors, total] = await Promise.all([
      this.prisma.sponsor.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              createdAt: true,
              status: true,
              message: true,
              companyName: true,
            },
          },
        },
        orderBy: [
          { displayOrder: 'asc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sponsor.count({ where }),
    ]);

    return {
      sponsors,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get sponsor by ID (admin)
  async getSponsorById(id: string) {
    const sponsor = await this.prisma.sponsor.findUnique({
      where: { id },
      include: {
        booking: true,
      },
    });

    if (!sponsor) {
      throw new NotFoundException('Sponsor not found');
    }

    return sponsor;
  }

  // Update sponsor (admin)
  async updateSponsor(id: string, dto: UpdateSponsorDto, userId?: string) {
    const sponsor = await this.getSponsorById(id);

    // Build update data — only include fields that were actually sent
    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.websiteUrl !== undefined) data.websiteUrl = dto.websiteUrl || null;
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    // Empty string means "clear the logo"
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl || null;

    const updated = await this.prisma.sponsor.update({
      where: { id },
      data,
      include: {
        booking: true,
      },
    });

    await this.activityLog.log({
      action: 'sponsor_updated',
      entityType: 'SPONSOR',
      entityId: sponsor.bookingId,
      userId: undefined,
      details: { sponsorId: id, fields: Object.keys(data) },
    });

    return {
      success: true,
      sponsor: updated,
    };
  }

  // Upload sponsor logo (admin)
  async uploadLogo(id: string, logoUrl: string, userId?: string) {
    const sponsor = await this.getSponsorById(id);

    await this.prisma.sponsor.update({
      where: { id },
      data: { logoUrl },
    });

    await this.activityLog.log({
      action: 'sponsor_logo_uploaded',
      entityType: 'SPONSOR',
      entityId: sponsor.bookingId,
      userId: undefined,
      details: { sponsorId: id },
    });

    return {
      success: true,
      logoUrl,
    };
  }

  // Delete sponsor (admin)
  async deleteSponsor(id: string, userId?: string) {
    const sponsor = await this.getSponsorById(id);

    // Log before deleting (booking cascade will remove the log otherwise)
    await this.activityLog.log({
      action: 'sponsor_deleted',
      entityType: 'SPONSOR',
      entityId: sponsor.bookingId,
      userId: undefined,
      details: { sponsorId: id, companyName: sponsor.companyName },
    });

    await this.prisma.sponsor.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Sponsor deleted successfully',
    };
  }
}
