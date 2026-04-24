import { IsString, IsEmail, IsOptional, IsEnum, IsNumber, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSponsorDto {
  @IsOptional()
  @IsEnum(['INQUIRY', 'NEGOTIATING', 'CONFIRMED', 'ACTIVE', 'INACTIVE'])
  status?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBrandingDto {
  @IsOptional()
  @IsEnum(['INQUIRY', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE'])
  status?: string;

  @IsOptional()
  @IsString()
  artworkUrl?: string;

  @IsOptional()
  specifications?: any;
}
