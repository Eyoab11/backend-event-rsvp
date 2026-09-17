-- AlterTable: record gala check-in on the main booking holder
ALTER TABLE "bookings" ADD COLUMN "checkedIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bookings" ADD COLUMN "checkedInAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "bookings_checkedIn_idx" ON "bookings"("checkedIn");
