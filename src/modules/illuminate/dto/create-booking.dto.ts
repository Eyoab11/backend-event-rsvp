import { IsString, IsEmail, IsNumber, IsOptional, IsEnum, Min, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export enum BookingType {
  TICKET = 'TICKET',
  SPONSOR = 'SPONSOR',
}

export class CreateTicketBookingDto {
  @IsString()
  customerName: string;

  @IsEmail()
  customerEmail: string;

  @IsString()
  customerPhone: string;

  @IsString()
  ticketTier: string;

  @IsString()
  ticketName: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pricePerUnit: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalAmount: number;

  @IsOptional()
  @IsString()
  specialRequests?: string;

  @IsOptional()
  @IsString()
  dietaryRestrictions?: string;

  @IsOptional()
  @IsString()
  tablePreferences?: string;
}

export class CreateSponsorInquiryDto {
  @IsString()
  companyName: string;

  @IsString()
  contactName: string;

  @IsEmail()
  contactEmail: string;

  @IsString()
  contactPhone: string;

  @IsString()
  sponsorTier: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class UpdateBookingDto {
  @IsOptional()
  @IsEnum(['PENDING', 'CONTACTED', 'CONFIRMED', 'CANCELLED'])
  status?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;

  @IsOptional()
  followUpDate?: Date;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seatNumbers?: string[];

  @IsOptional()
  @IsString()
  tableNumber?: string;
}

export class AssignSeatsDto {
  @IsArray()
  @IsString({ each: true })
  seatNumbers: string[];

  @IsOptional()
  @IsString()
  tableNumber?: string;

  @IsOptional()
  sendEmail?: boolean;
}

export class UpdateSeatAssignmentsDto {
  @IsArray()
  seatAssignments: { name: string; seatNumber: string }[];
}
