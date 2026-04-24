import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { QrModule } from '../qr/qr.module';

// Services
import { BookingService } from './services/booking.service';
import { SponsorService } from './services/sponsor.service';
import { SeatService } from './services/seat.service';
import { ActivityLogService } from './services/activity-log.service';
import { DashboardService } from './services/dashboard.service';
import { IlluminateEmailService } from './services/illuminate-email.service';
import { PlusOneService } from './services/plus-one.service';

// Controllers
import { BookingController } from './controllers/booking.controller';
import { SponsorController } from './controllers/sponsor.controller';
import { SeatController } from './controllers/seat.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { PlusOneController } from './controllers/plus-one.controller';

@Module({
  imports: [PrismaModule, EmailModule, AuthModule, QrModule],
  controllers: [
    BookingController,
    SponsorController,
    SeatController,
    DashboardController,
    PlusOneController,
  ],
  providers: [
    BookingService,
    SponsorService,
    SeatService,
    ActivityLogService,
    DashboardService,
    IlluminateEmailService,
    PlusOneService,
  ],
  exports: [
    BookingService,
    SponsorService,
    SeatService,
    ActivityLogService,
    DashboardService,
    PlusOneService,
  ],
})
export class IlluminateModule {}
