import { Module } from '@nestjs/common';
import { RsvpController } from './rsvp.controller';
import { RsvpService } from './rsvp.service';
import { InviteModule } from '../invite/invite.module';
import { EmailModule } from '../email/email.module';
import { CalendarModule } from '../calendar/calendar.module';
import { SheetsModule } from '../sheets/sheets.module';
import { QrModule } from '../qr/qr.module';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    InviteModule,
    EmailModule,
    CalendarModule,
    SheetsModule,
    QrModule,
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 10, // 10 requests per minute
    }]),
  ],
  controllers: [RsvpController],
  providers: [RsvpService],
  exports: [RsvpService],
})
export class RsvpModule {}
