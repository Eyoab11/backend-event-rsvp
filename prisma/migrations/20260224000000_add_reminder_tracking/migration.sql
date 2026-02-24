-- AlterTable
ALTER TABLE "invites" ADD COLUMN "lastReminderSent" TIMESTAMP(3),
ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;
