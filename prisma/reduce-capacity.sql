-- Temporarily reduce capacity to test waitlist
UPDATE events SET capacity = 5, "currentRegistrations" = 4 WHERE id = 'test-event-123';