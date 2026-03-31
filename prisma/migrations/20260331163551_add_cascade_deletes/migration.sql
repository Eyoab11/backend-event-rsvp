-- DropForeignKey
ALTER TABLE "attendees" DROP CONSTRAINT "attendees_inviteId_fkey";

-- DropForeignKey
ALTER TABLE "plus_ones" DROP CONSTRAINT "plus_ones_attendeeId_fkey";

-- AddForeignKey
ALTER TABLE "attendees" ADD CONSTRAINT "attendees_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plus_ones" ADD CONSTRAINT "plus_ones_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "attendees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
