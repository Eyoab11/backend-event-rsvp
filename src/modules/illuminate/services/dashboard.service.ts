import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActivityLogService } from './activity-log.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  // Get dashboard statistics
  async getDashboardStats() {
    const [
      totalBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      ticketBookings,
      sponsorInquiries,
      brandingInquiries,
      totalSeats,
      availableSeats,
      recentActivity,
    ] = await Promise.all([
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'PENDING' } }),
      this.prisma.booking.count({ where: { status: 'CONFIRMED' } }),
      this.prisma.booking.count({ where: { status: 'CANCELLED' } }),
      this.prisma.booking.findMany({
        where: { type: 'TICKET' },
        select: { ticketTier: true, quantity: true, totalAmount: true },
      }),
      this.prisma.booking.count({ where: { type: 'SPONSOR' } }),
      this.prisma.booking.count({ where: { type: 'BRANDING' } }),
      this.prisma.seat.count(),
      this.prisma.seat.count({ where: { isAvailable: true } }),
      this.activityLog.getRecentActivity(10),
    ]);

    // Calculate ticket sales breakdown
    const ticketsSold = {
      individual: 0,
      table: 0,
      vip: 0,
      total: 0,
    };

    ticketBookings.forEach((booking) => {
      const tier = booking.ticketTier?.toLowerCase() || '';
      if (tier.includes('vip')) {
        ticketsSold.vip += booking.quantity;
      } else if (tier.includes('table')) {
        ticketsSold.table += booking.quantity;
      } else {
        ticketsSold.individual += booking.quantity;
      }
      ticketsSold.total += booking.quantity;
    });

    // Calculate total revenue
    const revenueData = await this.prisma.booking.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        status: {
          in: ['CONFIRMED', 'CONTACTED'],
        },
      },
    });

    const totalRevenue = Number(revenueData._sum.totalAmount || 0);

    // Revenue by type
    const revenueByType = await Promise.all([
      this.prisma.booking.aggregate({
        _sum: { totalAmount: true },
        where: { type: 'TICKET', status: { in: ['CONFIRMED', 'CONTACTED'] } },
      }),
      this.prisma.booking.aggregate({
        _sum: { totalAmount: true },
        where: { 
          type: 'SPONSOR', 
          OR: [
            { status: { in: ['CONFIRMED', 'CONTACTED'] } },
            { sponsor: { status: 'ACTIVE' } }
          ]
        },
      }),
      this.prisma.booking.aggregate({
        _sum: { totalAmount: true },
        where: { type: 'BRANDING', status: { in: ['CONFIRMED', 'CONTACTED'] } },
      }),
    ]);

    return {
      totalBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      totalRevenue,
      revenueByType: {
        tickets: Number(revenueByType[0]._sum.totalAmount || 0),
        sponsors: Number(revenueByType[1]._sum.totalAmount || 0),
        branding: Number(revenueByType[2]._sum.totalAmount || 0),
      },
      ticketsSold,
      sponsorInquiries,
      brandingInquiries,
      seatInventory: {
        total: totalSeats,
        available: availableSeats,
        reserved: totalSeats - availableSeats,
        percentageAvailable: totalSeats > 0 ? Math.round((availableSeats / totalSeats) * 100) : 0,
      },
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        timestamp: log.timestamp,
        userName: log.user?.name || 'System',
        details: log.details,
      })),
    };
  }

  // Get bookings by status for charts
  async getBookingsByStatus() {
    const bookings = await this.prisma.booking.groupBy({
      by: ['status'],
      _count: {
        id: true,
      },
    });

    return bookings.map((b) => ({
      status: b.status,
      count: b._count.id,
    }));
  }

  // Get bookings by type for charts
  async getBookingsByType() {
    const bookings = await this.prisma.booking.groupBy({
      by: ['type'],
      _count: {
        id: true,
      },
    });

    return bookings.map((b) => ({
      type: b.type,
      count: b._count.id,
    }));
  }

  // Get revenue over time (last 30 days)
  async getRevenueOverTime() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookings = await this.prisma.booking.findMany({
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
        status: {
          in: ['CONFIRMED', 'CONTACTED'],
        },
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by date
    const revenueByDate = bookings.reduce((acc, booking) => {
      const date = booking.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += Number(booking.totalAmount);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(revenueByDate).map(([date, amount]) => ({
      date,
      amount,
    }));
  }

  // Export bookings to CSV
  async exportBookings(params: {
    type?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (params.type) {
      where.type = params.type;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        sponsor: true,
        branding: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Convert to CSV format
    const headers = [
      'ID',
      'Type',
      'Status',
      'Customer Name',
      'Email',
      'Phone',
      'Company',
      'Ticket Tier',
      'Sponsor Tier',
      'Branding Type',
      'Quantity',
      'Price Per Unit',
      'Total Amount',
      'Seat Numbers',
      'Section',
      'Created At',
    ];

    const rows = bookings.map((b) => [
      b.id,
      b.type,
      b.status,
      b.customerName,
      b.customerEmail,
      b.customerPhone,
      b.companyName || '',
      b.ticketTier || '',
      b.sponsorTier || '',
      b.brandingType || '',
      b.quantity,
      b.pricePerUnit,
      b.totalAmount,
      b.seatNumbers.join(', '),
      b.createdAt.toISOString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    return csv;
  }
}
