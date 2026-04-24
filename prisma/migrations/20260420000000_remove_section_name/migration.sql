-- AlterTable: Remove sectionName from bookings table
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "sectionName";

-- DropIndex: Remove sectionName index from seats table
DROP INDEX IF EXISTS "seats_sectionName_idx";

-- AlterTable: Remove sectionName from seats table
ALTER TABLE "seats" DROP COLUMN IF EXISTS "sectionName";
