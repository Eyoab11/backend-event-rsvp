import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSeatDto, BulkCreateSeatsDto, UpdateSeatDto } from '../dto/create-seat.dto';
import { ActivityLogService } from './activity-log.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SeatService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  // Get seat inventory with filters (admin)
  async getSeats(params: {
    seatType?: string;
    isAvailable?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { seatType, isAvailable, search, page = 1, limit = 100 } = params;

    const where: Prisma.SeatWhereInput = {};

    if (seatType) {
      where.seatType = seatType as any;
    }

    if (isAvailable !== undefined) {
      where.isAvailable = isAvailable;
    }

    if (search) {
      where.OR = [
        { seatNumber: { contains: search, mode: 'insensitive' } },
        { tableNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [seats, total, available, reserved] = await Promise.all([
      this.prisma.seat.findMany({
        where,
        include: {
          booking: {
            select: {
              id: true,
              customerName: true,
              customerEmail: true,
              type: true,
            },
          },
        },
        orderBy: [
          { seatNumber: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.seat.count({ where }),
      this.prisma.seat.count({ where: { ...where, isAvailable: true } }),
      this.prisma.seat.count({ where: { ...where, isAvailable: false } }),
    ]);

    return {
      seats,
      total,
      available,
      reserved,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get seat by ID (admin)
  async getSeatById(id: string) {
    const seat = await this.prisma.seat.findUnique({
      where: { id },
      include: {
        booking: true,
      },
    });

    if (!seat) {
      throw new NotFoundException('Seat not found');
    }

    return seat;
  }

  // Create single seat (admin)
  async createSeat(dto: CreateSeatDto, userId?: string) {
    // Check if seat number already exists
    const existing = await this.prisma.seat.findUnique({
      where: { seatNumber: dto.seatNumber },
    });

    if (existing) {
      throw new ConflictException(`Seat ${dto.seatNumber} already exists`);
    }

    const seat = await this.prisma.seat.create({
      data: {
        seatNumber: dto.seatNumber,
        tableNumber: dto.tableNumber,
        seatType: dto.seatType as any,
        isAvailable: true,
      },
    });

    await this.activityLog.log({
      action: 'seat_created',
      entityType: 'SEAT',
      entityId: seat.id,
      userId,
      details: { seatNumber: dto.seatNumber },
    });

    return {
      success: true,
      seat,
    };
  }

  // Bulk create seats (admin)
  async bulkCreateSeats(dto: BulkCreateSeatsDto, userId?: string) {
    // Check for duplicates in the request
    const seatNumbers = dto.seats.map(s => s.seatNumber);
    const duplicates = seatNumbers.filter((item, index) => seatNumbers.indexOf(item) !== index);
    
    if (duplicates.length > 0) {
      throw new BadRequestException(`Duplicate seat numbers in request: ${duplicates.join(', ')}`);
    }

    // Check for existing seats
    const existing = await this.prisma.seat.findMany({
      where: {
        seatNumber: { in: seatNumbers },
      },
    });

    if (existing.length > 0) {
      throw new ConflictException(
        `Seats already exist: ${existing.map(s => s.seatNumber).join(', ')}`
      );
    }

    // Create all seats
    const seats = await this.prisma.seat.createMany({
      data: dto.seats.map(s => ({
        seatNumber: s.seatNumber,
        tableNumber: s.tableNumber,
        seatType: s.seatType as any,
        isAvailable: true,
      })),
    });

    await this.activityLog.log({
      action: 'seats_bulk_created',
      entityType: 'SEAT',
      entityId: 'bulk',
      userId,
      details: { count: dto.seats.length },
    });

    return {
      success: true,
      created: seats.count,
      message: `${seats.count} seats created successfully`,
    };
  }

  // Update seat (admin)
  async updateSeat(id: string, dto: UpdateSeatDto, userId?: string) {
    const seat = await this.getSeatById(id);

    const updated = await this.prisma.seat.update({
      where: { id },
      data: {
        isAvailable: dto.isAvailable,
        bookingId: dto.bookingId,
      },
    });

    await this.activityLog.log({
      action: 'seat_updated',
      entityType: 'SEAT',
      entityId: id,
      userId,
      details: { changes: dto },
    });

    return {
      success: true,
      seat: updated,
    };
  }

  // Release seat from booking (admin)
  async releaseSeat(id: string, userId?: string) {
    const seat = await this.getSeatById(id);

    if (seat.isAvailable) {
      throw new BadRequestException('Seat is already available');
    }

    // Get the booking ID before releasing
    const bookingId = seat.bookingId;

    // Update seat and booking in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Release the seat
      await tx.seat.update({
        where: { id },
        data: {
          isAvailable: true,
          bookingId: null,
          reservedAt: null,
          tableNumber: null,
        },
      });

      // Update the booking to remove this seat from seatNumbers array
      if (bookingId) {
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          select: { seatNumbers: true, tableNumber: true },
        });

        if (booking) {
          // Remove the released seat from the booking's seatNumbers array
          const updatedSeatNumbers = (booking.seatNumbers || []).filter(
            (sn: string) => sn !== seat.seatNumber
          );

          // If no seats remain, also clear the table number
          const updateData: any = {
            seatNumbers: updatedSeatNumbers,
          };

          if (updatedSeatNumbers.length === 0) {
            updateData.tableNumber = null;
          }

          await tx.booking.update({
            where: { id: bookingId },
            data: updateData,
          });
        }
      }
    });

    await this.activityLog.log({
      action: 'seat_released',
      entityType: 'SEAT',
      entityId: id,
      userId,
      details: { 
        seatNumber: seat.seatNumber,
        bookingId: bookingId,
        removedFromBooking: true,
      },
    });

    return {
      success: true,
      message: `Seat ${seat.seatNumber} released and removed from booking`,
    };
  }

  // Delete seat (admin)
  async deleteSeat(id: string, userId?: string) {
    const seat = await this.getSeatById(id);

    if (!seat.isAvailable) {
      throw new BadRequestException('Cannot delete a reserved seat. Release it first.');
    }

    await this.prisma.seat.delete({
      where: { id },
    });

    await this.activityLog.log({
      action: 'seat_deleted',
      entityType: 'SEAT',
      entityId: id,
      userId,
      details: { seatNumber: seat.seatNumber },
    });

    return {
      success: true,
      message: 'Seat deleted successfully',
    };
  }

  // Get seat availability overview (admin)
  async getSeatAvailabilityOverview() {
    const totalSeats = await this.prisma.seat.count();
    const totalAvailable = await this.prisma.seat.count({ where: { isAvailable: true } });
    const totalReserved = totalSeats - totalAvailable;

    return {
      overall: {
        total: totalSeats,
        available: totalAvailable,
        reserved: totalReserved,
        percentageAvailable: totalSeats > 0 ? Math.round((totalAvailable / totalSeats) * 100) : 0,
      },
    };
  }
}
