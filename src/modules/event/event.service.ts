import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Event, Prisma } from '@prisma/client';

export interface CreateEventDto {
  eventName: string;
  description?: string;
  eventDate: Date;
  eventStartTime: string;
  eventEndTime: string;
  venueName: string;
  venueAddress: string;
  venueCity: string;
  venueState: string;
  venueZipCode: string;
  venueLatitude?: number;
  venueLongitude?: number;
  capacity: number;
  waitlistEnabled?: boolean;
  registrationOpen?: boolean;
  dressCode: string;
}

export interface UpdateEventDto {
  eventName?: string;
  description?: string;
  eventDate?: Date;
  eventStartTime?: string;
  eventEndTime?: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  venueState?: string;
  venueZipCode?: string;
  venueLatitude?: number;
  venueLongitude?: number;
  capacity?: number;
  waitlistEnabled?: boolean;
  registrationOpen?: boolean;
  dressCode?: string;
}

@Injectable()
export class EventService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Event | null> {
    return this.prisma.event.findUnique({
      where: { id },
    });
  }

  async findAll(): Promise<Event[]> {
    return this.prisma.event.findMany({
      orderBy: { eventDate: 'asc' },
    });
  }

  async create(data: CreateEventDto): Promise<Event> {
    return this.prisma.event.create({
      data: {
        ...data,
        currentRegistrations: 0,
        waitlistEnabled: data.waitlistEnabled ?? false,
        registrationOpen: data.registrationOpen ?? true,
      },
    });
  }

  async update(id: string, data: UpdateEventDto): Promise<Event> {
    const event = await this.findById(id);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    return this.prisma.event.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    const event = await this.findById(id);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    await this.prisma.event.delete({
      where: { id },
    });
  }
}