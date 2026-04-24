const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parse sponsor tier amount from tier string
function parseSponsorTierAmount(tierString) {
  const match = tierString.match(/\$([0-9,]+)/);
  if (!match) return 0;
  return parseInt(match[1].replace(/,/g, ''), 10);
}

async function fixSponsorAmounts() {
  console.log('Fixing sponsor booking amounts...\n');

  // Get all sponsor bookings
  const sponsorBookings = await prisma.booking.findMany({
    where: {
      type: 'SPONSOR',
    },
    include: {
      sponsor: true,
    },
  });

  console.log(`Found ${sponsorBookings.length} sponsor bookings\n`);

  for (const booking of sponsorBookings) {
    const tierAmount = parseSponsorTierAmount(booking.sponsorTier || '');
    
    if (tierAmount > 0 && booking.totalAmount !== tierAmount) {
      console.log(`Updating ${booking.companyName}:`);
      console.log(`  Tier: ${booking.sponsorTier}`);
      console.log(`  Old amount: $${booking.totalAmount}`);
      console.log(`  New amount: $${tierAmount}`);
      
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          pricePerUnit: tierAmount,
          totalAmount: tierAmount,
        },
      });
      
      console.log(`  ✓ Updated\n`);
    } else {
      console.log(`Skipping ${booking.companyName} (already correct or no tier amount found)\n`);
    }
  }

  console.log('Done!');
  await prisma.$disconnect();
}

fixSponsorAmounts().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
