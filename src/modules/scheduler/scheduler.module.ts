import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { InviteModule } from '../invite/invite.module';

@Module({
  imports: [InviteModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
