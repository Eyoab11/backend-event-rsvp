-- Restore original capacity
UPDATE events SET capacity = 150, "currentRegistrations" = 3 WHERE id = 'test-event-123';