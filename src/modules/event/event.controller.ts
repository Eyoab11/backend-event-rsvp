import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EventService } from './event.service';
import type { CreateEventDto, UpdateEventDto } from './event.service';
import { Event } from '@prisma/client';

@Controller('event')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get(':id')
  async getEvent(@Param('id') id: string): Promise<Event> {
    const event = await this.eventService.findById(id);
    if (!event) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }
    return event;
  }

  @Get()
  async getAllEvents(): Promise<Event[]> {
    return this.eventService.findAll();
  }

  @Post()
  async createEvent(@Body() data: CreateEventDto): Promise<Event> {
    return this.eventService.create(data);
  }

  @Put(':id')
  async updateEvent(
    @Param('id') id: string,
    @Body() data: UpdateEventDto,
  ): Promise<Event> {
    return this.eventService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEvent(@Param('id') id: string): Promise<void> {
    return this.eventService.delete(id);
  }
}
