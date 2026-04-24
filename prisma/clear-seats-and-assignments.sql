-- Clear all seat assignments and delete all seats
-- This will reset the seating system completely

-- Step 1: Clear seat assignments from bookings
UPDATE "Booking" 
SET "seatNumbers" = '{}', 
    "tableNumber" = NULL, 
    "sectionName" = NULL
WHERE "seatNumbers" IS NOT NULL;

-- Step 2: Delete all seats
DELETE FROM "Seat";

-- Step 3: Reset any related data
-- This ensures a clean slate for the new seat numbering system

SELECT 'Seats cleared successfully. You can now generate the new 500 seats with T1-01 format.' as message;
