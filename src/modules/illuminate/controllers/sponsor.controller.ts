import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SponsorService } from '../services/sponsor.service';
import { UpdateSponsorDto } from '../dto/create-sponsor.dto';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@Controller('illuminate/sponsors')
export class SponsorController {
  constructor(private readonly sponsorService: SponsorService) {}

  // PUBLIC ENDPOINTS

  @Get('active')
  async getActiveSponsors() {
    return this.sponsorService.getActiveSponsors();
  }

  // ADMIN ENDPOINTS

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async listSponsors(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.sponsorService.listSponsors({
      status,
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async getSponsorById(@Param('id') id: string) {
    return this.sponsorService.getSponsorById(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  async updateSponsor(
    @Param('id') id: string,
    @Body() dto: UpdateSponsorDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id;
    return this.sponsorService.updateSponsor(id, dto, userId);
  }

  @Post(':id/logo')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage() }))
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    const userId = req.user?.id;

    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    // Convert to base64 data URL — no external storage needed
    const mimeType = file.mimetype || 'image/png';
    const base64 = file.buffer.toString('base64');
    const logoUrl = `data:${mimeType};base64,${base64}`;

    return this.sponsorService.uploadLogo(id, logoUrl, userId);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async deleteSponsor(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.sponsorService.deleteSponsor(id, userId);
  }
}
