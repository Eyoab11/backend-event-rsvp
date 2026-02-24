import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InviteService } from '../invite/invite.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private reminderInterval: NodeJS.Timeout | null = null;
  private readonly reminderIntervalDays: number;
  private readonly checkIntervalHours: number;
  private isProcessing = false;
  private static instance: SchedulerService | null = null;

  constructor(private readonly inviteService: InviteService) {
    // Prevent multiple instances
    if (SchedulerService.instance) {
      this.logger.warn('Scheduler instance already exists, skipping initialization');
      return;
    }
    SchedulerService.instance = this;

    // Get configuration from environment variables
    this.reminderIntervalDays = parseInt(process.env.REMINDER_INTERVAL_DAYS || '7');
    this.checkIntervalHours = parseFloat(process.env.REMINDER_CHECK_INTERVAL_HOURS || '24');
    
    this.logger.log('Scheduler service initialized');
  }

  /**
   * Called when the module is initialized
   */
  onModuleInit() {
    // Start the scheduler if enabled
    if (process.env.ENABLE_AUTO_REMINDERS === 'true') {
      // Delay start by 2 seconds to avoid hot reload issues
      setTimeout(() => {
        this.startReminderScheduler();
      }, 2000);
    }
  }

  /**
   * Called when the module is destroyed
   */
  onModuleDestroy() {
    this.stopReminderScheduler();
    SchedulerService.instance = null;
  }

  /**
   * Start the automated reminder scheduler
   */
  startReminderScheduler(): void {
    if (this.reminderInterval) {
      this.logger.warn('Reminder scheduler is already running');
      return;
    }

    this.logger.log(
      `Starting reminder scheduler: checking every ${this.checkIntervalHours} hours (${this.checkIntervalHours * 60} minutes), ` +
      `sending reminders every ${this.reminderIntervalDays} days`
    );

    // Run immediately on startup
    this.processReminders();

    // Then run on interval
    const intervalMs = this.checkIntervalHours * 60 * 60 * 1000;
    this.logger.log(`Next check in ${intervalMs / 1000 / 60} minutes`);
    
    this.reminderInterval = setInterval(() => {
      this.processReminders();
    }, intervalMs);
  }

  /**
   * Stop the automated reminder scheduler
   */
  stopReminderScheduler(): void {
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
      this.logger.log('Reminder scheduler stopped');
    }
  }

  /**
   * Process all pending reminders
   */
  private async processReminders(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      this.logger.warn('Reminder processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;
    
    try {
      this.logger.log('Processing reminder emails...');
      const results = await this.inviteService.processReminders(this.reminderIntervalDays);
      this.logger.log(
        `Reminder processing complete: ${results.sent} sent, ${results.failed} failed`
      );
    } catch (error) {
      this.logger.error('Error processing reminders:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manually trigger reminder processing
   */
  async triggerReminders(reminderIntervalDays?: number): Promise<{
    sent: number;
    failed: number;
  }> {
    const intervalDays = reminderIntervalDays || this.reminderIntervalDays;
    this.logger.log(`Manually triggering reminders with ${intervalDays} day interval`);
    return this.inviteService.processReminders(intervalDays);
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    reminderIntervalDays: number;
    checkIntervalHours: number;
    isProcessing: boolean;
  } {
    return {
      isRunning: this.reminderInterval !== null,
      reminderIntervalDays: this.reminderIntervalDays,
      checkIntervalHours: this.checkIntervalHours,
      isProcessing: this.isProcessing,
    };
  }
}
