import { IsString, IsOptional, IsEnum, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSeatDto {
  @IsString()
  seatNumber: string;

  @IsOptional()
  @IsString()
  tableNumber?: string;

  @IsEnum(['INDIVIDUAL', 'TABLE', 'VIP'])
  seatType: string;
}

export class BulkCreateSeatsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSeatDto)
  seats: CreateSeatDto[];
}

export class UpdateSeatDto {
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  bookingId?: string;
}
