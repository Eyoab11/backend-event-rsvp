import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create a test event
  const event = await prisma.event.create({
    data: {
      eventName: 'LEM Ventures Official Launch',
      description: 'Join us for the official launch of LEM Ventures - an exclusive evening of networking, innovation, and celebration.',
      eventDate: new Date('2026-02-21T19:00:00-08:00'),
      eventStartTime: '19:00',
      eventEndTime: '23:00',
      venueName: 'The Ritz Carlton',
      venueAddress: '900 W Olympic Blvd',
      venueCity: 'Los Angeles',
      venueState: 'CA',
      venueZipCode: '90015',
      venueLatitude: 34.0430,
      venueLongitude: -118.2673,
      capacity: 150,
      currentRegistrations: 0,
      waitlistEnabled: true,
      registrationOpen: true,
      dressCode: 'Business Formal',
    },
  });

  console.log('✅ Created event:', event.eventName);

  // Create some test invites
  const invites = await Promise.all([
    prisma.invite.create({
      data: {
        email: 'john.doe@example.com',
        token: 'test-token-123',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        inviteType: 'VIP',
        eventId: event.id,
      },
    }),
    prisma.invite.create({
      data: {
        email: 'jane.smith@partner.com',
        token: 'test-token-456',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        inviteType: 'PARTNER',
        eventId: event.id,
      },
    }),
    prisma.invite.create({
      data: {
        email: 'guest@general.com',
        token: 'test-token-789',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        inviteType: 'GENERAL',
        eventId: event.id,
      },
    }),
  ]);

  console.log(`✅ Created ${invites.length} test invites`);
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });