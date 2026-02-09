import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SheetsService } from '../sheets/sheets.service';
import { AttendeeStatus, Prisma } from '@prisma/client';

// Type for attendee with relations
type AttendeeWithRelations = Prisma.AttendeeGetPayload<{
  include: {
    plusOne: true;
    invite: true;
  };
}>;

export interface EventStats {
  totalCapacity: number;
  currentRegistrations: number;
  availableSlots: number;
  confirmedAttendees: number;
  waitlistedAttendees: number;
  cancelledAttendees: number;
  attendeesWithPlusOne: number;
  totalPlusOnes: number;
  inviteStats: {
    total: number;
    used: number;
    unused: number;
    expired: number;
  };
}

export interface DashboardStats {
  totalEvents: number;
  upcomingEvents: number;
  totalAttendees: number;
  confirmedAttendees: number;
  waitlistedAttendees: number;
  cancelledAttendees: number;
  totalInvites: number;
  usedInvites: number;
  pendingInvites: number;
  recentActivity: Activity[];
}

export interface Activity {
  id: string;
  type: 'rsvp' | 'check_in' | 'invite_sent' | 'event_created';
  description: string;
  timestamp: string;
  eventName?: string;
}

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private sheetsService: SheetsService,
  ) {}

  async getAttendees(eventId: string): Promise<AttendeeWithRelations[]> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return this.prisma.attendee.findMany({
      where: { eventId },
      include: {
        plusOne: true,
        invite: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getEventStats(eventId: string): Promise<EventStats> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        attendees: {
          include: {
            plusOne: true,
          },
        },
        invites: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const confirmedAttendees = event.attendees.filter(
      (a) => a.status === AttendeeStatus.CONFIRMED,
    ).length;

    const waitlistedAttendees = event.attendees.filter(
      (a) => a.status === AttendeeStatus.WAITLISTED,
    ).length;

    const cancelledAttendees = event.attendees.filter(
      (a) => a.status === AttendeeStatus.CANCELLED,
    ).length;

    const attendeesWithPlusOne = event.attendees.filter(
      (a) => a.plusOne !== null,
    ).length;

    const totalPlusOnes = event.attendees.reduce(
      (count, a) => count + (a.plusOne ? 1 : 0),
      0,
    );

    const usedInvites = event.invites.filter((i) => i.isUsed).length;
    const unusedInvites = event.invites.filter((i) => !i.isUsed).length;
    const expiredInvites = event.invites.filter(
      (i) => new Date() > i.expiresAt,
    ).length;

    return {
      totalCapacity: event.capacity,
      currentRegistrations: event.currentRegistrations,
      availableSlots: event.capacity - event.currentRegistrations,
      confirmedAttendees,
      waitlistedAttendees,
      cancelledAttendees,
      attendeesWithPlusOne,
      totalPlusOnes,
      inviteStats: {
        total: event.invites.length,
        used: usedInvites,
        unused: unusedInvites,
        expired: expiredInvites,
      },
    };
  }

  async exportAttendees(eventId: string): Promise<string> {
    const attendees = await this.getAttendees(eventId);

    // CSV header
    const headers = [
      'Registration ID',
      'Name',
      'Company',
      'Title',
      'Email',
      'Status',
      'Has Plus One',
      'Plus One Name',
      'Plus One Company',
      'Plus One Title',
      'Plus One Email',
      'QR Code',
      'Registration Date',
    ];

    // CSV rows
    const rows = attendees.map((attendee) => [
      attendee.registrationId,
      attendee.name,
      attendee.company,
      attendee.title,
      attendee.email,
      attendee.status,
      attendee.plusOne ? 'Yes' : 'No',
      attendee.plusOne?.name || '',
      attendee.plusOne?.company || '',
      attendee.plusOne?.title || '',
      attendee.plusOne?.email || '',
      attendee.qrCode,
      attendee.createdAt.toISOString(),
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
      ),
    ].join('\n');

    return csvContent;
  }

  async cancelAttendee(attendeeId: string): Promise<void> {
    const attendee = await this.prisma.attendee.findUnique({
      where: { id: attendeeId },
      include: { plusOne: true },
    });

    if (!attendee) {
      throw new NotFoundException('Attendee not found');
    }

    if (attendee.status === AttendeeStatus.CANCELLED) {
      throw new Error('Attendee is already cancelled');
    }

    const slotsToFree = attendee.plusOne ? 2 : 1;

    await this.prisma.$transaction(async (tx) => {
      // Update attendee status
      await tx.attendee.update({
        where: { id: attendeeId },
        data: { status: AttendeeStatus.CANCELLED },
      });

      // Free up capacity if was confirmed
      if (attendee.status === AttendeeStatus.CONFIRMED) {
        await tx.event.update({
          where: { id: attendee.eventId },
          data: {
            currentRegistrations: {
              decrement: slotsToFree,
            },
          },
        });
      }
    });
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();

    // Get total events
    const totalEvents = await this.prisma.event.count();

    // Get upcoming events (events with eventDate >= today)
    const upcomingEvents = await this.prisma.event.count({
      where: {
        eventDate: {
          gte: now,
        },
      },
    });

    // Get total attendees (all statuses)
    const totalAttendees = await this.prisma.attendee.count();

    // Get confirmed attendees
    const confirmedAttendees = await this.prisma.attendee.count({
      where: {
        status: AttendeeStatus.CONFIRMED,
      },
    });

    // Get waitlisted attendees
    const waitlistedAttendees = await this.prisma.attendee.count({
      where: {
        status: AttendeeStatus.WAITLISTED,
      },
    });

    // Get cancelled attendees
    const cancelledAttendees = await this.prisma.attendee.count({
      where: {
        status: AttendeeStatus.CANCELLED,
      },
    });

    // Get total invites
    const totalInvites = await this.prisma.invite.count();

    // Get used invites
    const usedInvites = await this.prisma.invite.count({
      where: {
        isUsed: true,
      },
    });

    // Get pending invites (not used and not expired)
    const pendingInvites = await this.prisma.invite.count({
      where: {
        isUsed: false,
        expiresAt: {
          gt: now,
        },
      },
    });

    // Get recent activity (last 10 activities)
    const recentAttendees = await this.prisma.attendee.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        event: {
          select: {
            eventName: true,
          },
        },
      },
    });

    const recentInvites = await this.prisma.invite.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        event: {
          select: {
            eventName: true,
          },
        },
      },
    });

    const recentEvents = await this.prisma.event.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Combine and sort all activities
    const activities: Activity[] = [];

    recentAttendees.forEach((attendee) => {
      activities.push({
        id: `attendee-${attendee.id}`,
        type: 'rsvp',
        description: `${attendee.name} registered for the event`,
        timestamp: attendee.createdAt.toISOString(),
        eventName: attendee.event.eventName,
      });
    });

    recentInvites.forEach((invite) => {
      activities.push({
        id: `invite-${invite.id}`,
        type: 'invite_sent',
        description: `Invite sent to ${invite.email}`,
        timestamp: invite.createdAt.toISOString(),
        eventName: invite.event.eventName,
      });
    });

    recentEvents.forEach((event) => {
      activities.push({
        id: `event-${event.id}`,
        type: 'event_created',
        description: `Event "${event.eventName}" created`,
        timestamp: event.createdAt.toISOString(),
        eventName: event.eventName,
      });
    });

    // Sort by timestamp descending and take top 10
    const recentActivity = activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 10);

    return {
      totalEvents,
      upcomingEvents,
      totalAttendees,
      confirmedAttendees,
      waitlistedAttendees,
      cancelledAttendees,
      totalInvites,
      usedInvites,
      pendingInvites,
      recentActivity,
    };
  }

  async getSheetUrl(): Promise<{ url: string | null }> {
    const url = this.sheetsService.getSheetUrl();
    return { url };
  }

  async initializeSheet(): Promise<{ message: string }> {
    await this.sheetsService.initializeSheet();
    return { message: 'Sheet initialization triggered' };
  }
}
