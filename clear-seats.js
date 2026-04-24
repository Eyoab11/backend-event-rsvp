const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearSeats() {
  try {
    console.log('🧹 Clearing all seat assignments and seats...');

    // Step 1: Clear seat assignments from bookings
    const updatedBookings = await prisma.booking.updateMany({
      where: {
        seatNumbers: {
          isEmpty: false,
        },
      },
      data: {
        seatNumbers: [],
        tableNumber: null,
        sectionName: null,
      },
    });
    console.log(`✅ Cleared seat assignments from ${updatedBookings.count} bookings`);

    // Step 2: Delete all seats
    const deletedSeats = await prisma.seat.deleteMany({});
    console.log(`✅ Deleted ${deletedSeats.count} seats`);

    console.log('\n✨ Database cleared successfully!');
    console.log('You can now generate the new 500 seats with T1-01 format.');
  } catch (error) {
    console.error('❌ Error clearing seats:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearSeats();
