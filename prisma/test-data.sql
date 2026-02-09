-- Insert test event
INSERT INTO events (
  id, 
  "eventName", 
  description, 
  "eventDate", 
  "eventStartTime", 
  "eventEndTime", 
  "venueName", 
  "venueAddress", 
  "venueCity", 
  "venueState", 
  "venueZipCode", 
  "venueLatitude", 
  "venueLongitude", 
  capacity, 
  "currentRegistrations", 
  "waitlistEnabled", 
  "registrationOpen", 
  "dressCode", 
  "createdAt", 
  "updatedAt"
) VALUES (
  'test-event-123',
  'LEM Ventures Official Launch',
  'Join us for the official launch of LEM Ventures - an exclusive evening of networking, innovation, and celebration.',
  '2026-02-21 19:00:00-08:00',
  '19:00',
  '23:00',
  'The Ritz Carlton',
  '900 W Olympic Blvd',
  'Los Angeles',
  'CA',
  '90015',
  34.0430,
  -118.2673,
  150,
  47,
  true,
  true,
  'Business Formal',
  NOW(),
  NOW()
);

-- Insert test invites
INSERT INTO invites (
  id,
  email,
  token,
  "isUsed",
  "expiresAt",
  "eventId",
  "createdAt"
) VALUES 
(
  'invite-1',
  'john.doe@example.com',
  'test-token-123',
  false,
  NOW() + INTERVAL '30 days',
  'test-event-123',
  NOW()
),
(
  'invite-2',
  'jane.smith@partner.com',
  'test-token-456',
  false,
  NOW() + INTERVAL '30 days',
  'test-event-123',
  NOW()
),
(
  'invite-3',
  'guest@general.com',
  'test-token-789',
  false,
  NOW() + INTERVAL '30 days',
  'test-event-123',
  NOW()
);