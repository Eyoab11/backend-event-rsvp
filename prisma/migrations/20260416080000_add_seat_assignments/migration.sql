-- Add seatAssignments JSON column to bookings table
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "seatAssignments" JSONB;
