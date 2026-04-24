/**
 * Fix sponsor visibility issue
 * 
 * This script ensures all sponsors with status='ACTIVE' also have isActive=true
 * so they appear on the public website.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSponsorVisibility() {
  console.log('🔍 Checking for sponsors with visibility issues...\n');

  // Find sponsors with status='ACTIVE' but isActive=false
  const problematicSponsors = await prisma.sponsor.findMany({
    where: {
      status: 'ACTIVE',
      isActive: false,
    },
    select: {
      id: true,
      companyName: true,
      tier: true,
      status: true,
      isActive: true,
      logoUrl: true,
    },
  });

  if (problematicSponsors.length === 0) {
    console.log('✅ No visibility issues found. All ACTIVE sponsors have isActive=true');
    
    // Show current active sponsors
    const activeSponsors = await prisma.sponsor.findMany({
      where: {
        status: 'ACTIVE',
        isActive: true,
      },
      select: {
        companyName: true,
        tier: true,
        logoUrl: true,
      },
    });
    
    console.log(`\n📊 Currently visible sponsors: ${activeSponsors.length}`);
    activeSponsors.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.companyName} (${s.tier}) - Logo: ${s.logoUrl ? '✓' : '✗'}`);
    });
  } else {
    console.log(`⚠️  Found ${problematicSponsors.length} sponsor(s) with visibility issues:\n`);
    
    problematicSponsors.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.companyName}`);
      console.log(`      Tier: ${s.tier}`);
      console.log(`      Status: ${s.status}`);
      console.log(`      isActive: ${s.isActive}`);
      console.log(`      Logo: ${s.logoUrl ? 'Yes' : 'No'}`);
      console.log('');
    });

    console.log('🔧 Fixing visibility issues...\n');

    // Fix each sponsor
    for (const sponsor of problematicSponsors) {
      await prisma.sponsor.update({
        where: { id: sponsor.id },
        data: { isActive: true },
      });
      console.log(`   ✓ Fixed: ${sponsor.companyName}`);
    }

    console.log(`\n✅ Fixed ${problematicSponsors.length} sponsor(s)`);
  }

  // Show all sponsors and their visibility status
  console.log('\n📋 All sponsors status:');
  const allSponsors = await prisma.sponsor.findMany({
    select: {
      companyName: true,
      status: true,
      isActive: true,
      logoUrl: true,
    },
    orderBy: {
      displayOrder: 'asc',
    },
  });

  allSponsors.forEach((s, i) => {
    const visible = s.status === 'ACTIVE' && s.isActive;
    const icon = visible ? '🟢' : '⚪';
    const logo = s.logoUrl ? '📷' : '  ';
    console.log(`   ${icon} ${logo} ${s.companyName} - ${s.status} (isActive: ${s.isActive})`);
  });

  console.log('\n💡 Note: Only sponsors with status=ACTIVE AND isActive=true appear on the website');
}

fixSponsorVisibility()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
