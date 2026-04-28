import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateTicketBookingDto,
  CreateSponsorInquiryDto,
  UpdateBookingDto,
  AssignSeatsDto,
} from '../dto/create-booking.dto';
import { ActivityLogService } from './activity-log.service';
import { IlluminateEmailService } from './illuminate-email.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private emailService: IlluminateEmailService,
  ) {}

  /**
   * Generate a sequential booking ID in format ILG0001, ILG0002, etc.
   */
  private async generateBookingId(): Promise<string> {
    // Get the latest booking to determine the next number
    const latestBooking = await this.prisma.booking.findFirst({
      where: {
        id: {
          startsWith: 'ILG',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
      },
    });

    let nextNumber = 1;
    if (latestBooking) {
      // Extract the number from the ID (e.g., "ILG0001" -> 1)
      const currentNumber = parseInt(latestBooking.id.substring(3), 10);
      nextNumber = currentNumber + 1;
    }

    // Format as ILG#### (e.g., ILG0001, ILG0002, etc.)
    return `ILG${nextNumber.toString().padStart(4, '0')}`;
  }

  // Create ticket booking (admin — auto-confirmed)
  async createAdminBooking(
    dto: CreateTicketBookingDto,
    userId?: string,
    ipAddress?: string,
  ) {
    const bookingId = await this.generateBookingId();
    
    const booking = await this.prisma.booking.create({
      data: {
        id: bookingId,
        type: 'TICKET',
        status: 'CONFIRMED',
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
        ticketTier: dto.ticketTier,
        ticketName: dto.ticketName,
        quantity: dto.quantity,
        pricePerUnit: dto.pricePerUnit,
        totalAmount: dto.totalAmount,
        specialRequests: dto.specialRequests,
        dietaryRestrictions: dto.dietaryRestrictions,
        tablePreferences: dto.tablePreferences,
        seatNumbers: [],
      },
    });

    this.activityLog
      .log({
        action: 'admin_booking_created',
        entityType: 'BOOKING',
        entityId: booking.id,
        userId,
        details: {
          type: 'TICKET',
          tier: dto.ticketTier,
          quantity: dto.quantity,
          source: 'admin',
        },
        ipAddress,
      })
      .catch((err) => console.error('Activity log error:', err));

    // DO NOT auto-assign seats - admin will manually click "Auto Assign" button

    return {
      success: true,
      bookingId: booking.id,
      message:
        'Booking created and confirmed. Use "Auto Assign" to assign seats.',
    };
  }

  // Create ticket booking
  async createTicketBooking(dto: CreateTicketBookingDto, ipAddress?: string) {
    const bookingId = await this.generateBookingId();
    
    const booking = await this.prisma.booking.create({
      data: {
        id: bookingId,
        type: 'TICKET',
        status: 'PENDING',
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
        ticketTier: dto.ticketTier,
        ticketName: dto.ticketName,
        quantity: dto.quantity,
        pricePerUnit: dto.pricePerUnit,
        totalAmount: dto.totalAmount,
        specialRequests: dto.specialRequests,
        dietaryRestrictions: dto.dietaryRestrictions,
        tablePreferences: dto.tablePreferences,
        seatNumbers: [],
      },
    });

    // Log activity (non-blocking — don't fail the booking if logging fails)
    this.activityLog
      .log({
        action: 'booking_created',
        entityType: 'BOOKING',
        entityId: booking.id,
        details: {
          type: 'TICKET',
          tier: dto.ticketTier,
          quantity: dto.quantity,
        },
        ipAddress,
      })
      .catch((err) => console.error('Activity log error:', err));

    // Send emails (non-blocking — don't fail the booking if email fails)
    this.emailService
      .sendTicketBookingConfirmation(booking)
      .catch((err) => console.error('Confirmation email error:', err));
    this.emailService
      .sendAdminNotification('new_booking', booking)
      .catch((err) => console.error('Admin notification error:', err));

    return {
      success: true,
      bookingId: booking.id,
      message:
        'Ticket booking received! We will contact you within 24-48 hours.',
    };
  }

  // Create sponsor inquiry
  async createSponsorInquiry(dto: CreateSponsorInquiryDto, ipAddress?: string) {
    // Check if tier is full
    await this.validateSponsorTierAvailability(dto.sponsorTier);

    // Parse sponsor tier amount from the tier string (e.g., "Beacon Gold — $25,000" -> 25000)
    const tierAmount = this.parseSponsorTierAmount(dto.sponsorTier);
    
    const bookingId = await this.generateBookingId();

    const booking = await this.prisma.booking.create({
      data: {
        id: bookingId,
        type: 'SPONSOR',
        status: 'PENDING',
        customerName: dto.contactName,
        customerEmail: dto.contactEmail,
        customerPhone: dto.contactPhone,
        companyName: dto.companyName,
        sponsorTier: dto.sponsorTier,
        message: dto.message,
        quantity: 1,
        pricePerUnit: tierAmount,
        totalAmount: tierAmount,
        seatNumbers: [],
        sponsor: {
          create: {
            tier: dto.sponsorTier,
            companyName: dto.companyName,
            contactName: dto.contactName,
            contactEmail: dto.contactEmail,
            contactPhone: dto.contactPhone,
            status: 'INQUIRY',
          },
        },
      },
      include: {
        sponsor: true,
      },
    });

    await this.activityLog.log({
      action: 'sponsor_inquiry_created',
      entityType: 'SPONSOR',
      entityId: booking.id,
      details: { tier: dto.sponsorTier, company: dto.companyName },
      ipAddress,
    });

    await this.emailService.sendSponsorInquiryConfirmation(booking);
    await this.emailService.sendAdminNotification('new_sponsor', booking);

    return {
      success: true,
      inquiryId: booking.id,
      message:
        'Thank you for your interest! Our partnerships team will contact you within 24 hours.',
    };
  }

  // Create sponsor inquiry from admin (auto-confirmed, ready for logo upload)
  async createAdminSponsorInquiry(
    dto: CreateSponsorInquiryDto,
    userId?: string,
    ipAddress?: string,
  ) {
    // Check if tier is full
    await this.validateSponsorTierAvailability(dto.sponsorTier);

    // Parse sponsor tier amount from the tier string (e.g., "Beacon Gold — $25,000" -> 25000)
    const tierAmount = this.parseSponsorTierAmount(dto.sponsorTier);
    
    const bookingId = await this.generateBookingId();

    const booking = await this.prisma.booking.create({
      data: {
        id: bookingId,
        type: 'SPONSOR',
        status: 'CONFIRMED', // Auto-confirmed for admin-created sponsors
        customerName: dto.contactName,
        customerEmail: dto.contactEmail,
        customerPhone: dto.contactPhone,
        companyName: dto.companyName,
        sponsorTier: dto.sponsorTier,
        message: dto.message,
        quantity: 1,
        pricePerUnit: tierAmount,
        totalAmount: tierAmount,
        seatNumbers: [],
        sponsor: {
          create: {
            tier: dto.sponsorTier,
            companyName: dto.companyName,
            contactName: dto.contactName,
            contactEmail: dto.contactEmail,
            contactPhone: dto.contactPhone,
            status: 'CONFIRMED', // Auto-confirmed, ready for logo upload
          },
        },
      },
      include: {
        sponsor: true,
      },
    });

    await this.activityLog.log({
      action: 'admin_sponsor_created',
      entityType: 'SPONSOR',
      entityId: booking.id,
      userId,
      details: {
        tier: dto.sponsorTier,
        company: dto.companyName,
        source: 'admin',
      },
      ipAddress,
    });

    // Send confirmation email to sponsor
    await this.emailService.sendSponsorConfirmation(booking);

    return {
      success: true,
      inquiryId: booking.id,
      message:
        'Sponsor created and confirmed. Upload a logo and approve to make it live.',
    };
  }

  // Get booking by ID
  async getBookingById(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        sponsor: true,
        seats: true,
        plusOnes: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  // Verify booking exists (public endpoint)
  async verifyBooking(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      exists: !!booking,
      type: booking?.type,
      status: booking?.status,
      createdAt: booking?.createdAt,
    };
  }

  // List bookings with filters (admin)
  async listBookings(params: {
    type?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      type,
      status,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.BookingWhereInput = {};

    if (type) {
      where.type = type as any;
    }

    if (status) {
      where.status = status as any;
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          sponsor: true,
          seats: true,
          plusOnes: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      bookings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Update booking (admin)
  async updateBooking(id: string, dto: UpdateBookingDto, userId?: string) {
    const booking = await this.getBookingById(id);
    const wasNotConfirmed = booking.status !== 'CONFIRMED';
    const isBeingConfirmed = dto.status === 'CONFIRMED';

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        status: dto.status as any,
        adminNotes: dto.adminNotes,
        followUpDate: dto.followUpDate,
        assignedTo: dto.assignedTo,
        seatNumbers: dto.seatNumbers,
        tableNumber: dto.tableNumber,
      },
      include: {
        sponsor: true,
        seats: true,
      },
    });

    await this.activityLog.log({
      action: 'booking_updated',
      entityType: 'BOOKING',
      entityId: id,
      userId,
      details: { changes: dto },
    });

    // When a TICKET booking transitions to CONFIRMED, auto-assign seats
    // Email will be sent AFTER seat assignment is complete
    if (isBeingConfirmed && wasNotConfirmed && booking.type === 'TICKET') {
      this.autoAssignSeatsAndNotify(id, booking.quantity, userId).catch((err) =>
        console.error('Auto-assign/email error on confirm:', err),
      );
    }

    // When a SPONSOR booking transitions to CONFIRMED, send confirmation email
    if (isBeingConfirmed && wasNotConfirmed && booking.type === 'SPONSOR') {
      this.emailService
        .sendSponsorConfirmation(updated)
        .catch((err) =>
          console.error('Sponsor confirmation email error:', err),
        );
    }

    return {
      success: true,
      booking: updated,
    };
  }

  /**
   * Auto-assign the next available seats for a booking and send the full confirmed email.
   * Called when a booking is confirmed (either via admin create or status update).
   * Email is sent ONLY AFTER seats are successfully assigned.
   */
  private async autoAssignSeatsAndNotify(
    bookingId: string,
    quantity: number,
    userId?: string,
  ) {
    const booking = await this.getBookingById(bookingId);

    // Skip if seats are already assigned — just resend the email
    if (booking.seatNumbers.length > 0) {
      await this.emailService.sendConfirmedBookingEmail(booking);
      return;
    }

    const tableNumber = await this.getNextTableNumber();
    const seatNumbers = await this.provisionSeats(
      quantity,
      tableNumber,
      bookingId,
    );

    // Assign seats in a transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.seat.updateMany({
        where: { seatNumber: { in: seatNumbers } },
        data: {
          isAvailable: false,
          bookingId,
          reservedAt: new Date(),
          tableNumber,
        },
      });

      return tx.booking.update({
        where: { id: bookingId },
        data: {
          seatNumbers,
          tableNumber: this.extractTableNumberFromSeat(seatNumbers[0]),
        },
        include: { seats: true, plusOnes: true },
      });
    });

    await this.activityLog
      .log({
        action: 'seats_auto_assigned',
        entityType: 'BOOKING',
        entityId: bookingId,
        userId,
        details: { seatNumbers, tableNumber, source: 'auto' },
      })
      .catch((err) => console.error('Activity log error:', err));

    // Send the full confirmed email with QR code + calendar + seat info
    // ONLY AFTER seat assignment is complete
    await this.emailService.sendConfirmedBookingEmail(updated);

    // If booking has Plus Ones, assign adjacent seats and send their emails
    if (updated.plusOnes && updated.plusOnes.length > 0) {
      for (const plusOne of updated.plusOnes) {
        // Skip if Plus One already has a seat
        if (plusOne.seatNumber) continue;

        // Find adjacent seat
        const adjacentSeat = await this.findAdjacentSeatForPlusOne(
          updated.seatNumbers[0],
          bookingId,
        );

        if (adjacentSeat) {
          // Assign seat to Plus One
          await this.prisma.$transaction(async (tx) => {
            await tx.seat.update({
              where: { seatNumber: adjacentSeat },
              data: {
                isAvailable: false,
                bookingId,
                plusOneId: plusOne.id, // Link seat to Plus One
                reservedAt: new Date(),
              },
            });

            await tx.illuminatePlusOne.update({
              where: { id: plusOne.id },
              data: { seatNumber: adjacentSeat },
            });
          });

          // Get updated Plus One with seat
          const updatedPlusOne = await this.prisma.illuminatePlusOne.findUnique(
            {
              where: { id: plusOne.id },
            },
          );

          // Send Plus One confirmation email
          await this.emailService.sendPlusOneConfirmation(
            updated,
            updatedPlusOne!,
          );
        }
      }
    }
  }

  /**
   * Manually trigger seat assignment + confirmation email for an already-confirmed booking.
   * Used by the admin to assign seats to bookings confirmed before auto-assign existed.
   */
  async manualAutoAssign(id: string, userId?: string) {
    const booking = await this.getBookingById(id);

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Only confirmed bookings can have seats auto-assigned.',
      );
    }

    if (booking.type !== 'TICKET') {
      throw new BadRequestException(
        'Seat assignment is only applicable to ticket bookings.',
      );
    }

    // Already assigned — just resend the email
    if (booking.seatNumbers.length > 0) {
      await this.emailService.sendConfirmedBookingEmail(booking);
      return {
        success: true,
        message: 'Seats already assigned. Confirmation email resent.',
        booking,
      };
    }

    const tableNumber = await this.getNextTableNumber();
    const seatNumbers = await this.provisionSeats(
      booking.quantity,
      tableNumber,
      id,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.seat.updateMany({
        where: { seatNumber: { in: seatNumbers } },
        data: {
          isAvailable: false,
          bookingId: id,
          reservedAt: new Date(),
          tableNumber,
        },
      });

      return tx.booking.update({
        where: { id },
        data: {
          seatNumbers,
          tableNumber: this.extractTableNumberFromSeat(seatNumbers[0]),
        },
        include: { seats: true },
      });
    });

    await this.activityLog
      .log({
        action: 'seats_manually_auto_assigned',
        entityType: 'BOOKING',
        entityId: id,
        userId,
        details: { seatNumbers, tableNumber },
      })
      .catch((err) => console.error('Activity log error:', err));

    await this.emailService.sendConfirmedBookingEmail(updated);

    return {
      success: true,
      message: `Seats assigned (Table ${tableNumber}). Confirmation email sent.`,
      booking: updated,
    };
  }

  /**
   * Provision N seats for a booking.
   * Uses existing available inventory first; creates virtual seats if inventory is insufficient.
   * Virtual seats are named T{table}-S{n} so they're identifiable.
   *
   * SEATING RULES:
   * - Tables 1-4 (T1, T2, T3, T4) are reserved for VIP Individual tickets only
   * - Circle of Illumination (Table of 10) bookings get a full table (10 seats from same table)
   * - Individual tickets fill gaps in partially filled tables first (efficient packing)
   * - Seats are assigned in order: lowest table number first, then lowest seat number
   */
  private async provisionSeats(
    quantity: number,
    tableNumber: string,
    bookingId: string,
  ): Promise<string[]> {
    // Get the booking to check ticket type
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { ticketTier: true, ticketName: true },
    });

    const isVIPIndividual = booking?.ticketTier?.toLowerCase().includes('vip');
    const isCircleOfIllumination =
      booking?.ticketTier === 'Table of 10' ||
      booking?.ticketName?.toLowerCase().includes('circle of illumination');

    // CIRCLE OF ILLUMINATION: Must book entire table (10 seats from same table)
    if (isCircleOfIllumination) {
      return this.provisionFullTable(tableNumber, bookingId);
    }

    // INDIVIDUAL TICKETS: Fill partially occupied tables first (efficient packing)
    // Get all available seats sorted by table number, then seat number
    const availableSeats = await this.prisma.seat.findMany({
      where: { isAvailable: true },
      orderBy: { seatNumber: 'asc' }, // T1-01, T1-02, T2-01, T2-02, etc.
    });

    // Group seats by table number and count occupancy
    const seatsByTable = new Map<number, string[]>();
    const tableOccupancy = new Map<number, number>();

    for (const seat of availableSeats) {
      const match = seat.seatNumber.match(/^T(\d+)-/);
      if (!match) continue;

      const tableNum = parseInt(match[1], 10);

      // Filter based on VIP status
      if (tableNum >= 1 && tableNum <= 4) {
        if (!isVIPIndividual) continue; // Skip VIP tables for non-VIP
      } else {
        if (isVIPIndividual) continue; // VIP should only get T1-T4
      }

      if (!seatsByTable.has(tableNum)) {
        seatsByTable.set(tableNum, []);
      }
      seatsByTable.get(tableNum)!.push(seat.seatNumber);
    }

    // Calculate occupancy for each table (how many seats are already taken)
    for (const [tableNum, seats] of seatsByTable.entries()) {
      const totalSeatsAtTable = await this.prisma.seat.count({
        where: {
          seatNumber: { startsWith: `T${tableNum}-` },
        },
      });
      const occupiedSeats = totalSeatsAtTable - seats.length;
      tableOccupancy.set(tableNum, occupiedSeats);
    }

    // Sort tables by occupancy (descending) then by table number (ascending)
    // This fills partially occupied tables first, then moves to empty tables
    const sortedTables = Array.from(seatsByTable.entries())
      .map(([tableNum, seats]) => ({
        tableNum,
        seats,
        occupancy: tableOccupancy.get(tableNum) || 0,
      }))
      .sort((a, b) => {
        // First sort by occupancy (higher occupancy first - fill gaps)
        if (b.occupancy !== a.occupancy) {
          return b.occupancy - a.occupancy;
        }
        // Then sort by table number (lower table number first)
        return a.tableNum - b.tableNum;
      });

    // Select seats from sorted tables
    const selectedSeats: string[] = [];
    for (const table of sortedTables) {
      if (selectedSeats.length >= quantity) break;

      const seatsNeeded = quantity - selectedSeats.length;
      const seatsFromThisTable = table.seats.slice(0, seatsNeeded);
      selectedSeats.push(...seatsFromThisTable);
    }

    if (selectedSeats.length >= quantity) {
      return selectedSeats.slice(0, quantity);
    }

    // Not enough in inventory — create virtual seats for the shortfall
    const needed = quantity - selectedSeats.length;
    const candidates: string[] = [];
    for (let i = 1; i <= needed; i++) {
      candidates.push(`T${tableNumber}-S${i}`);
    }

    // Check for collisions with existing seat numbers
    const collisions = await this.prisma.seat.findMany({
      where: { seatNumber: { in: candidates } },
      select: { seatNumber: true },
    });
    const collisionSet = new Set(collisions.map((s) => s.seatNumber));

    const safeVirtual: string[] = [];
    let counter = needed + 1;
    for (const sn of candidates) {
      if (!collisionSet.has(sn)) {
        safeVirtual.push(sn);
      } else {
        let fallback = `T${tableNumber}-S${counter}`;
        while (collisionSet.has(fallback)) {
          counter++;
          fallback = `T${tableNumber}-S${counter}`;
        }
        safeVirtual.push(fallback);
        collisionSet.add(fallback);
        counter++;
      }
    }

    // Create the virtual seats in DB
    if (safeVirtual.length > 0) {
      await this.prisma.seat.createMany({
        data: safeVirtual.map((sn) => ({
          seatNumber: sn,
          tableNumber,
          seatType: 'STANDARD' as any,
          isAvailable: true,
        })),
        skipDuplicates: true,
      });
    }

    return [...selectedSeats, ...safeVirtual];
  }

  /**
   * Provision a full table (10 seats) for Circle of Illumination bookings.
   * Finds an available table with 10 consecutive seats or creates a new table.
   * Prioritizes lower table numbers (T5, T6, T7...) to fill front rows first.
   */
  private async provisionFullTable(
    tableNumber: string,
    bookingId: string,
  ): Promise<string[]> {
    // Try to find an existing table with 10 available seats
    const allSeats = await this.prisma.seat.findMany({
      where: { isAvailable: true },
      orderBy: { seatNumber: 'asc' },
    });

    // Group seats by table number
    const seatsByTable = new Map<string, string[]>();
    for (const seat of allSeats) {
      const match = seat.seatNumber.match(/^T(\d+)-/);
      if (match) {
        const tNum = match[1];
        if (!seatsByTable.has(tNum)) {
          seatsByTable.set(tNum, []);
        }
        seatsByTable.get(tNum)!.push(seat.seatNumber);
      }
    }

    // Find tables with at least 10 available seats (skip T1-T4 which are VIP Individual only)
    // Sort by table number (ascending) to fill lower-numbered tables first (T5, T6, T7...)
    const availableTables = Array.from(seatsByTable.entries())
      .map(([tNum, seats]) => ({ tableNum: parseInt(tNum, 10), seats }))
      .filter((t) => t.tableNum >= 5 && t.seats.length >= 10)
      .sort((a, b) => a.tableNum - b.tableNum); // Sort ascending: T5, T6, T7...

    // Use the first available table (lowest table number)
    if (availableTables.length > 0) {
      const firstTable = availableTables[0];
      return firstTable.seats.slice(0, 10);
    }

    // No existing table available — create a new table with 10 seats
    const seatNumbers: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const seatNum = i.toString().padStart(2, '0');
      seatNumbers.push(`T${tableNumber}-${seatNum}`);
    }

    // Check for collisions
    const collisions = await this.prisma.seat.findMany({
      where: { seatNumber: { in: seatNumbers } },
      select: { seatNumber: true },
    });

    if (collisions.length > 0) {
      throw new BadRequestException(
        `Cannot create table ${tableNumber} — some seats already exist. Please use a different table number or contact support.`,
      );
    }

    // Create the 10 seats for this table
    await this.prisma.seat.createMany({
      data: seatNumbers.map((sn) => ({
        seatNumber: sn,
        tableNumber,
        seatType: 'TABLE' as any,
        isAvailable: true,
      })),
    });

    return seatNumbers;
  }

  // Get the next available table number (ascending, no gaps, re-usable after deletion)
  private async getNextTableNumber(): Promise<string> {
    // Get all currently assigned table numbers
    const bookingsWithTables = await this.prisma.booking.findMany({
      where: {
        tableNumber: { not: null },
      },
      select: { tableNumber: true },
    });

    const usedNumbers = new Set(
      bookingsWithTables
        .map((b) => parseInt(b.tableNumber!, 10))
        .filter((n) => !isNaN(n)),
    );

    // Find the lowest positive integer not currently in use
    let next = 1;
    while (usedNumbers.has(next)) {
      next++;
    }

    return String(next);
  }

  // Assign seats to booking (admin)
  async assignSeats(id: string, dto: AssignSeatsDto, userId?: string) {
    const booking = await this.getBookingById(id);

    // Validate seat availability
    const seats = await this.prisma.seat.findMany({
      where: {
        seatNumber: { in: dto.seatNumbers },
      },
    });

    const unavailableSeats = seats.filter(
      (s) => !s.isAvailable && s.bookingId !== id,
    );
    if (unavailableSeats.length > 0) {
      throw new BadRequestException(
        `Seats not available: ${unavailableSeats.map((s) => s.seatNumber).join(', ')}`,
      );
    }

    if (seats.length !== dto.seatNumbers.length) {
      throw new BadRequestException('Some seat numbers are invalid');
    }

    // Enforce seat count matches booking quantity
    if (dto.seatNumbers.length > booking.quantity) {
      throw new BadRequestException(
        `Cannot assign ${dto.seatNumbers.length} seats. This booking is for ${booking.quantity} seat${booking.quantity !== 1 ? 's' : ''}.`,
      );
    }

    // Check if this is a reassignment (booking already has seats)
    const isReassignment = booking.seatNumbers.length > 0;
    const oldSeatNumbers = [...booking.seatNumbers];

    console.log('[assignSeats] isReassignment:', isReassignment);
    console.log('[assignSeats] oldSeatNumbers:', oldSeatNumbers);
    console.log('[assignSeats] newSeatNumbers:', dto.seatNumbers);

    // Auto-assign table number: extract from seat number
    let tableNumber = dto.tableNumber;
    if (!tableNumber) {
      // Extract table number from the first seat (e.g., "T5-02" -> "5")
      tableNumber = this.extractTableNumberFromSeat(dto.seatNumbers[0]);
    }

    // Update booking and seats in transaction
    const updated = await this.prisma.$transaction(async (tx) => {
      // Release previously assigned seats for this booking (if reassigning)
      if (isReassignment) {
        await tx.seat.updateMany({
          where: {
            seatNumber: { in: oldSeatNumbers },
            bookingId: id,
          },
          data: {
            isAvailable: true,
            bookingId: null,
            reservedAt: null,
            tableNumber: null,
          },
        });
      }

      // Assign new seats
      await tx.seat.updateMany({
        where: { seatNumber: { in: dto.seatNumbers } },
        data: {
          isAvailable: false,
          bookingId: id,
          reservedAt: new Date(),
          tableNumber,
        },
      });

      // Update booking with new seat assignments
      return tx.booking.update({
        where: { id },
        data: {
          seatNumbers: dto.seatNumbers,
          tableNumber,
        },
        include: {
          seats: true,
        },
      });
    });

    await this.activityLog
      .log({
        action: isReassignment ? 'seats_reassigned' : 'seats_assigned',
        entityType: 'BOOKING',
        entityId: id,
        userId,
        details: {
          seatNumbers: dto.seatNumbers,
          tableNumber,
          oldSeatNumbers: isReassignment ? oldSeatNumbers : undefined,
        },
      })
      .catch((err) => console.error('Activity log error:', err));

    // Send appropriate email based on whether this is a reassignment
    const shouldSendEmail = dto.sendEmail !== false;
    if (shouldSendEmail && booking.status === 'CONFIRMED') {
      try {
        if (isReassignment) {
          // Send reassignment email with new QR code
          await this.emailService.sendSeatReassignmentEmail(
            updated,
            oldSeatNumbers,
          );
        } else {
          // Send initial confirmation email
          await this.emailService.sendConfirmedBookingEmail(updated);
        }
      } catch (emailError) {
        console.error(
          'Email send error (seats assigned successfully):',
          emailError,
        );
        // Continue - seats were assigned successfully even if email fails
      }
    }

    return {
      success: true,
      booking: updated,
      message: isReassignment
        ? `Seats reassigned successfully (Table ${tableNumber}). Old seats released.`
        : `Seats assigned successfully (Table ${tableNumber})`,
    };
  }

  // Update per-person seat assignments (admin)
  async updateSeatAssignments(
    id: string,
    assignments: { name: string; seatNumber: string }[],
    userId?: string,
  ) {
    const booking = await this.getBookingById(id);

    // Validate all seat numbers are actually assigned to this booking
    const invalid = assignments.filter(
      (a) => !booking.seatNumbers.includes(a.seatNumber),
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Seat numbers not assigned to this booking: ${invalid.map((a) => a.seatNumber).join(', ')}`,
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id },
      data: { seatAssignments: assignments as any },
      include: { seats: true },
    });

    await this.activityLog.log({
      action: 'seat_assignments_updated',
      entityType: 'BOOKING',
      entityId: id,
      userId,
      details: { assignments },
    });

    return { success: true, booking: updated };
  }

  // Delete/cancel booking (admin)
  async deleteBooking(id: string, userId?: string) {
    const booking = await this.getBookingById(id);

    // Release seats if assigned
    if (booking.seatNumbers.length > 0) {
      await this.prisma.seat.updateMany({
        where: { seatNumber: { in: booking.seatNumbers } },
        data: {
          isAvailable: true,
          bookingId: null,
          reservedAt: null,
        },
      });
    }

    await this.prisma.booking.delete({
      where: { id },
    });

    await this.activityLog.log({
      action: 'booking_deleted',
      entityType: 'BOOKING',
      entityId: id,
      userId,
      details: { customerName: booking.customerName, type: booking.type },
    });

    return {
      success: true,
      message: 'Booking deleted successfully',
    };
  }

  // Helper: Parse sponsor tier amount from tier string
  // Examples: "Beacon Gold — $25,000" -> 25000, "Luminary Presenting — $50,000+" -> 50000
  private parseSponsorTierAmount(tierString: string): number {
    const match = tierString.match(/\$([0-9,]+)/);
    if (!match) return 0;
    return parseInt(match[1].replace(/,/g, ''), 10);
  }

  // Helper: Extract table number from seat number
  // Examples: "T5-02" -> "5", "T12-01" -> "12"
  private extractTableNumberFromSeat(seatNumber: string): string {
    const match = seatNumber.match(/^T(\d+)-/);
    return match ? match[1] : seatNumber;
  }

  // Helper: Validate sponsor tier availability
  private async validateSponsorTierAvailability(
    tierString: string,
  ): Promise<void> {
    // Define tier slot limits
    const tierLimits: Record<string, number> = {
      'luminary presenting': 2,
      'beacon gold': 3,
      'radiance silver': 4,
      'spark community': 5,
    };

    // Find matching tier
    const tierKey = Object.keys(tierLimits).find((key) =>
      tierString.toLowerCase().includes(key),
    );

    if (!tierKey) {
      // Unknown tier - allow it (admin might have custom tiers)
      return;
    }

    const maxSlots = tierLimits[tierKey];

    // Count active and confirmed sponsors for this tier
    const existingSponsors = await this.prisma.sponsor.count({
      where: {
        tier: {
          contains: tierKey
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' '),
          mode: 'insensitive',
        },
        status: {
          in: ['CONFIRMED', 'ACTIVE'], // Only count confirmed/active sponsors
        },
      },
    });

    if (existingSponsors >= maxSlots) {
      throw new ConflictException(
        // cSpell:ignore waitlist
        `The ${tierKey
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(
            ' ',
          )} sponsorship tier is fully booked (${maxSlots}/${maxSlots} slots filled). Please select a different tier or contact us for wait-list options.`,
      );
    }
  }

  /**
   * Find an adjacent seat for a Plus One
   * Tries seats in order: +1, -1, +2, -2, etc. from the main attendee's seat
   */
  private async findAdjacentSeatForPlusOne(
    mainSeatNumber: string,
    bookingId: string,
  ): Promise<string | null> {
    // Extract table and seat number from main seat (e.g., "T5-02" -> table=5, seat=2)
    const match = mainSeatNumber.match(/^T(\d+)-(\d+)$/);
    if (!match) return null;

    const tableNum = parseInt(match[1], 10);
    const seatNum = parseInt(match[2], 10);

    // Try adjacent seats in order: +1, -1, +2, -2, +3, -3, etc.
    const offsets = [
      1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8, 9, -9,
    ];

    for (const offset of offsets) {
      const adjacentSeatNum = seatNum + offset;
      if (adjacentSeatNum < 1) continue; // Skip invalid seat numbers

      const adjacentSeatNumber = `T${tableNum}-${adjacentSeatNum.toString().padStart(2, '0')}`;

      // Check if seat exists and is available
      const seat = await this.prisma.seat.findFirst({
        where: {
          seatNumber: adjacentSeatNumber,
          isAvailable: true,
        },
      });

      if (seat) {
        return adjacentSeatNumber;
      }
    }

    // If no adjacent seat found, try any available seat at the same table
    const anySeatAtTable = await this.prisma.seat.findFirst({
      where: {
        seatNumber: { startsWith: `T${tableNum}-` },
        isAvailable: true,
      },
      orderBy: { seatNumber: 'asc' },
    });

    return anySeatAtTable?.seatNumber || null;
  }
}
