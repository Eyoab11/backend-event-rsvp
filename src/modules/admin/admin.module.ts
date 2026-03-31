import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SheetsModule } from '../sheets/sheets.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [SheetsModule, EmailModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
