-- Create a test invite for frontend testing
INSERT INTO invites (id, email, token, "isUsed", "expiresAt", "eventId", "createdAt")
VALUES (
  'test-invite-frontend',
  'frontend@test.com',
  'frontend-test-token-123',
  false,
  '2026-12-31',
  'test-event-123',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  "isUsed" = false,
  token = 'frontend-test-token-123',
  "expiresAt" = '2026-12-31';
