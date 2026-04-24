-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "seatAssignments" JSONB;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
