import { Module } from '@nestjs/common';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { SheetsModule } from '../sheets/sheets.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SheetsModule, AuthModule],
  controllers: [QrController],
  providers: [QrService],
  exports: [QrService]
})
export class QrModule {}
