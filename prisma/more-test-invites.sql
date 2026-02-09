-- Insert more test invites for different scenarios
INSERT INTO invites (
  id,
  email,
  token,
  "isUsed",
  "expiresAt",
  "eventId",
  "createdAt"
) VALUES 
-- Expired token
(
  'invite-expired',
  'expired@example.com',
  'expired-token-123',
  false,
  '2025-01-01 00:00:00',
  'test-event-123',
  NOW()
),
-- Valid token 1
(
  'invite-valid-1',
  'user1@example.com',
  'valid-token-123',
  false,
  NOW() + INTERVAL '30 days',
  'test-event-123',
  NOW()
),
-- Valid token 2
(
  'invite-valid-2',
  'user2@example.com',
  'valid-token-456',
  false,
  NOW() + INTERVAL '30 days',
  'test-event-123',
  NOW()
);