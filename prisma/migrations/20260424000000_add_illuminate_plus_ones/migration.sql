-- CreateTable
CREATE TABLE "illuminate_plus_ones" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "qrCode" TEXT NOT NULL,
    "seatNumber" TEXT,
    "dietaryRestrictions" TEXT,
    "specialRequests" TEXT,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "illuminate_plus_ones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "illuminate_plus_ones_qrCode_key" ON "illuminate_plus_ones"("qrCode");

-- CreateIndex
CREATE INDEX "illuminate_plus_ones_bookingId_idx" ON "illuminate_plus_ones"("bookingId");

-- CreateIndex
CREATE INDEX "illuminate_plus_ones_email_idx" ON "illuminate_plus_ones"("email");

-- CreateIndex
CREATE INDEX "illuminate_plus_ones_qrCode_idx" ON "illuminate_plus_ones"("qrCode");

-- AddForeignKey
ALTER TABLE "illuminate_plus_ones" ADD CONSTRAINT "illuminate_plus_ones_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
