import { AttendeeStatus } from '@prisma/client';

export class RegistrationResponseDto {
  attendee: {
    id: string;
    name: string;
    company: string;
    title: string;
    email: string;
    status: AttendeeStatus;
    registrationId: string;
    qrCode: string;
  };

  plusOne?: {
    name: string;
    company: string;
    title: string;
    email: string;
  };

  event: {
    id: string;
    eventName: string;
    eventDate: Date;
    eventStartTime: string;
    eventEndTime: string;
    venue: {
      name: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
    };
    capacity: number;
    currentRegistrations: number;
    waitlistEnabled: boolean;
    registrationOpen: boolean;
    dressCode: string;
    description: string;
  };

  isWaitlisted: boolean;
}