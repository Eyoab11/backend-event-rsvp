-- Safe Migration: Convert Booking IDs to Sequential Format (ILG####)
-- This migration preserves all existing data and relationships

-- Step 1: Add temporary column for new IDs
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "new_id" VARCHAR(20);

-- Step 2: Generate sequential IDs for existing bookings (ILG0001, ILG0002, etc.)
WITH numbered_bookings AS (
  SELECT 
    id,
    'ILG' || LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt")::TEXT, 4, '0') as sequential_id
  FROM "bookings"
)
UPDATE "bookings" b
SET "new_id" = nb.sequential_id
FROM numbered_bookings nb
WHERE b.id = nb.id;

-- Step 3: Create mapping table to track old ID -> new ID
CREATE TABLE IF NOT EXISTS "booking_id_mapping" (
  "old_id" TEXT PRIMARY KEY,
  "new_id" TEXT NOT NULL UNIQUE
);

INSERT INTO "booking_id_mapping" ("old_id", "new_id")
SELECT id, "new_id" FROM "bookings"
ON CONFLICT ("old_id") DO NOTHING;

-- Step 4: Drop foreign key constraints FIRST (before updating references)
ALTER TABLE "sponsors" DROP CONSTRAINT IF EXISTS "sponsors_bookingId_fkey";
ALTER TABLE "branding_opportunities" DROP CONSTRAINT IF EXISTS "branding_opportunities_bookingId_fkey";
ALTER TABLE "seats" DROP CONSTRAINT IF EXISTS "seats_bookingId_fkey";
ALTER TABLE "illuminate_plus_ones" DROP CONSTRAINT IF EXISTS "illuminate_plus_ones_bookingId_fkey";
ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "activity_logs_entityId_fkey";

-- Step 5: Update foreign key references in related tables (now safe without constraints)

-- Update sponsors
UPDATE "sponsors" s
SET "bookingId" = m."new_id"
FROM "booking_id_mapping" m
WHERE s."bookingId" = m."old_id";

-- Update branding_opportunities
UPDATE "branding_opportunities" bo
SET "bookingId" = m."new_id"
FROM "booking_id_mapping" m
WHERE bo."bookingId" = m."old_id";

-- Update seats
UPDATE "seats" st
SET "bookingId" = m."new_id"
FROM "booking_id_mapping" m
WHERE st."bookingId" = m."old_id" AND st."bookingId" IS NOT NULL;

-- Update illuminate_plus_ones
UPDATE "illuminate_plus_ones" ipo
SET "bookingId" = m."new_id"
FROM "booking_id_mapping" m
WHERE ipo."bookingId" = m."old_id";

-- Update activity_logs (only for BOOKING entity type)
UPDATE "activity_logs" al
SET "entityId" = m."new_id"
FROM "booking_id_mapping" m
WHERE al."entityId" = m."old_id" AND al."entityType" = 'BOOKING';

-- Step 6: Swap the IDs (drop old, rename new)
ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_pkey";
ALTER TABLE "bookings" DROP COLUMN "id";
ALTER TABLE "bookings" RENAME COLUMN "new_id" TO "id";
ALTER TABLE "bookings" ADD PRIMARY KEY ("id");

-- Step 7: Recreate foreign key constraints
ALTER TABLE "sponsors" 
  ADD CONSTRAINT "sponsors_bookingId_fkey" 
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "branding_opportunities" 
  ADD CONSTRAINT "branding_opportunities_bookingId_fkey" 
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seats" 
  ADD CONSTRAINT "seats_bookingId_fkey" 
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "illuminate_plus_ones" 
  ADD CONSTRAINT "illuminate_plus_ones_bookingId_fkey" 
  FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Note: activity_logs.entityId is not a foreign key, just a reference string

-- Step 8: Clean up mapping table (optional - keep for reference)
-- DROP TABLE IF EXISTS "booking_id_mapping";
