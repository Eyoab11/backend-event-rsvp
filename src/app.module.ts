import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { EventModule } from './modules/event/event.module';
import { InviteModule } from './modules/invite/invite.module';
import { RsvpModule } from './modules/rsvp/rsvp.module';
import { QrModule } from './modules/qr/qr.module';
import { AdminModule } from './modules/admin/admin.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { EmailModule } from './modules/email/email.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [PrismaModule, EventModule, InviteModule, RsvpModule, QrModule, AdminModule, CalendarModule, EmailModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
