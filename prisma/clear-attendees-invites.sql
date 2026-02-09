-- Clear all attendees and invites data from the database
-- This script deletes data in the correct order to respect foreign key constraints

-- Step 1: Delete all plus ones (depends on attendees)
DELETE FROM plus_ones;

-- Step 2: Delete all attendees (depends on invites)
DELETE FROM attendees;

-- Step 3: Delete all invites (depends on events)
DELETE FROM invites;

-- Step 4: Reset event registration counts (using camelCase as per Prisma schema)
UPDATE events SET "currentRegistrations" = 0;

-- Verify deletion
SELECT 'Plus Ones' as table_name, COUNT(*) as remaining_records FROM plus_ones
UNION ALL
SELECT 'Attendees' as table_name, COUNT(*) as remaining_records FROM attendees
UNION ALL
SELECT 'Invites' as table_name, COUNT(*) as remaining_records FROM invites;
