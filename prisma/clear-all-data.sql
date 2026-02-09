-- Clear All Data Script
-- This will delete all attendees, invites, plus-ones, and reset the database
-- WARNING: This action cannot be undone!

-- Disable foreign key checks temporarily (if needed)
-- SET session_replication_role = 'replica';

-- Delete all plus-ones first (they reference attendees)
DELETE FROM "plus_ones";

-- Delete all attendees (they reference invites and events)
DELETE FROM "attendees";

-- Delete all invites (they reference events)
DELETE FROM "invites";

-- Optionally, you can also delete events if you want to start completely fresh
-- DELETE FROM "events";

-- Re-enable foreign key checks
-- SET session_replication_role = 'origin';

-- Show counts after deletion
SELECT 'plus_ones' as table_name, COUNT(*) as remaining_records FROM "plus_ones"
UNION ALL
SELECT 'attendees', COUNT(*) FROM "attendees"
UNION ALL
SELECT 'invites', COUNT(*) FROM "invites"
UNION ALL
SELECT 'events', COUNT(*) FROM "events";
