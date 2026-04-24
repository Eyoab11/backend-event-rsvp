import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface LogParams {
  action: string;
  entityType: 'BOOKING' | 'SPONSOR' | 'BRANDING' | 'ADMIN' | 'SEAT';
  entityId: string;
  userId?: string;
  details?: any;
  ipAddress?: string;
}

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  // Log an activity
  async log(params: LogParams) {
    // Only include userId if it's provided and not empty
    const data: any = {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details || {},
      ipAddress: params.ipAddress,
    };

    // Only add userId if it's a valid string AND exists in the database
    if (params.userId && typeof params.userId === 'string') {
      // Verify the user exists before adding to avoid foreign key constraint error
      const userExists = await this.prisma.adminUser.findUnique({
        where: { id: params.userId },
        select: { id: true },
      }).catch(() => null);
      
      if (userExists) {
        data.userId = params.userId;
      }
    }

    return this.prisma.activityLog.create({
      data,
    });
  }

  // Get activity logs with filters
  async getLogs(params: {
    entityType?: string;
    entityId?: string;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const {
      entityType,
      entityId,
      userId,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = params;

    const where: Prisma.ActivityLogWhereInput = {};

    if (entityType) {
      where.entityType = entityType as any;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = startDate;
      }
      if (endDate) {
        where.timestamp.lte = endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get recent activity for dashboard
  async getRecentActivity(limit: number = 10) {
    return this.prisma.activityLog.findMany({
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }
}
