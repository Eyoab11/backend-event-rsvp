import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ActivityLogService } from './activity-log.service';

/**
 * Gala night check-in.
 *
 * A scanned code is one of two things:
 *  - a booking id, which is what the confirmation email's QR encodes for the
 *    main ticket holder, or
 *  - an `IlluminatePlusOne.qrCode` (the `PLO-…` codes), for a plus one guest.
 *
 * Both are resolved here so the scanner only ever deals with one code.
 */

export type GuestKind = 'BOOKING' | 'PLUS_ONE';

export interface CheckInGuest {
  kind: GuestKind;
  id: string;
  bookingId: string;
  name: string;
  email: string;
  status: string;
  checkedIn: boolean;
  checkedInAt: Date | null;
  seatNumbers: string[];
  tableNumber: string | null;
  ticketName: string | null;
  ticketTier: string | null;
  /** Set for plus ones: the ticket holder they came in under. */
  primaryAttendeeName?: string;
}

export interface CheckInResponse {
  valid: boolean;
  success?: boolean;
  alreadyCheckedIn?: boolean;
  message?: string;
  guest?: CheckInGuest;
}

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);

  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  /** Look the code up as a plus one first, then as a booking id. */
  private async resolve(code: string): Promise<CheckInGuest | null> {
    const trimmed = code.trim();
    if (!trimmed) return null;

    const plusOne = await this.prisma.illuminatePlusOne.findUnique({
      where: { qrCode: trimmed },
      include: { booking: true },
    });

    if (plusOne) {
      return {
        kind: 'PLUS_ONE',
        id: plusOne.id,
        bookingId: plusOne.bookingId,
        name: plusOne.name,
        email: plusOne.email,
        status: plusOne.booking.status,
        checkedIn: plusOne.checkedIn,
        checkedInAt: plusOne.checkedInAt,
        seatNumbers: plusOne.seatNumber ? [plusOne.seatNumber] : [],
        tableNumber: plusOne.booking.tableNumber,
        ticketName: 'Plus One Guest',
        ticketTier: 'Plus One',
        primaryAttendeeName: plusOne.booking.customerName,
      };
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: trimmed },
    });

    if (!booking) return null;

    return {
      kind: 'BOOKING',
      id: booking.id,
      bookingId: booking.id,
      name: booking.customerName,
      email: booking.customerEmail,
      status: booking.status,
      checkedIn: booking.checkedIn,
      checkedInAt: booking.checkedInAt,
      seatNumbers: booking.seatNumbers ?? [],
      tableNumber: booking.tableNumber,
      ticketName: booking.ticketName,
      ticketTier: booking.ticketTier,
    };
  }

  /**
   * Read-only lookup. Tells the scanner who the code belongs to and whether
   * they have already been checked in, without changing anything.
   */
  async verify(code: string): Promise<CheckInResponse> {
    const guest = await this.resolve(code);

    if (!guest) {
      return { valid: false, message: 'Invalid QR code — no booking found' };
    }

    if (guest.status === 'CANCELLED') {
      return { valid: false, message: 'This booking has been cancelled', guest };
    }

    if (guest.status !== 'CONFIRMED') {
      return {
        valid: false,
        message: `Booking is not confirmed (status: ${guest.status})`,
        guest,
      };
    }

    return {
      valid: true,
      alreadyCheckedIn: guest.checkedIn,
      message: guest.checkedIn ? 'Already checked in' : undefined,
      guest,
    };
  }

  /**
   * Check a guest in. Safe to call repeatedly — a second scan does not move the
   * timestamp, it comes back with `alreadyCheckedIn: true` so the scanner can
   * warn whoever is on the door.
   */
  async checkIn(code: string, userId?: string): Promise<CheckInResponse> {
    const verified = await this.verify(code);

    // Invalid, cancelled or unconfirmed — nothing to record.
    if (!verified.valid || !verified.guest) {
      return verified;
    }

    const guest = verified.guest;

    if (guest.checkedIn) {
      return {
        valid: true,
        success: false,
        alreadyCheckedIn: true,
        message: 'Already checked in',
        guest,
      };
    }

    const checkedInAt = new Date();

    if (guest.kind === 'PLUS_ONE') {
      await this.prisma.illuminatePlusOne.update({
        where: { id: guest.id },
        data: { checkedIn: true, checkedInAt },
      });
    } else {
      await this.prisma.booking.update({
        where: { id: guest.id },
        data: { checkedIn: true, checkedInAt },
      });
    }

    await this.activityLog.log({
      action: guest.kind === 'PLUS_ONE' ? 'plus_one_checked_in' : 'booking_checked_in',
      entityType: 'BOOKING',
      entityId: guest.bookingId,
      userId,
      details: { guestId: guest.id, name: guest.name, kind: guest.kind },
    });

    this.logger.log(`Checked in ${guest.kind} ${guest.id} (${guest.name})`);

    return {
      valid: true,
      success: true,
      alreadyCheckedIn: false,
      message: 'Check-in successful',
      guest: { ...guest, checkedIn: true, checkedInAt },
    };
  }

  /** Reverse a check-in — for when someone is scanned by mistake. */
  async undoCheckIn(code: string, userId?: string): Promise<CheckInResponse> {
    const guest = await this.resolve(code);

    if (!guest) {
      return { valid: false, message: 'Invalid QR code — no booking found' };
    }

    if (!guest.checkedIn) {
      return { valid: true, success: false, message: 'Guest is not checked in', guest };
    }

    if (guest.kind === 'PLUS_ONE') {
      await this.prisma.illuminatePlusOne.update({
        where: { id: guest.id },
        data: { checkedIn: false, checkedInAt: null },
      });
    } else {
      await this.prisma.booking.update({
        where: { id: guest.id },
        data: { checkedIn: false, checkedInAt: null },
      });
    }

    await this.activityLog.log({
      action: 'check_in_undone',
      entityType: 'BOOKING',
      entityId: guest.bookingId,
      userId,
      details: { guestId: guest.id, name: guest.name, kind: guest.kind },
    });

    return {
      valid: true,
      success: true,
      message: 'Check-in reversed',
      guest: { ...guest, checkedIn: false, checkedInAt: null },
    };
  }

  /** Counts for the door: how many of the expected guests have arrived. */
  async getStats() {
    const [bookingsTotal, bookingsIn, plusOnesTotal, plusOnesIn] = await Promise.all([
      this.prisma.booking.count({ where: { type: 'TICKET', status: 'CONFIRMED' } }),
      this.prisma.booking.count({
        where: { type: 'TICKET', status: 'CONFIRMED', checkedIn: true },
      }),
      this.prisma.illuminatePlusOne.count({
        where: { booking: { status: 'CONFIRMED' } },
      }),
      this.prisma.illuminatePlusOne.count({
        where: { booking: { status: 'CONFIRMED' }, checkedIn: true },
      }),
    ]);

    const expected = bookingsTotal + plusOnesTotal;
    const checkedIn = bookingsIn + plusOnesIn;

    return {
      expected,
      checkedIn,
      remaining: expected - checkedIn,
      checkInRate: expected > 0 ? Math.round((checkedIn / expected) * 100) : 0,
      bookings: { expected: bookingsTotal, checkedIn: bookingsIn },
      plusOnes: { expected: plusOnesTotal, checkedIn: plusOnesIn },
    };
  }
}
