-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('TICKET', 'SPONSOR', 'BRANDING');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONTACTED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SponsorStatus" AS ENUM ('INQUIRY', 'NEGOTIATING', 'CONFIRMED', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BrandingStatus" AS ENUM ('INQUIRY', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('INDIVIDUAL', 'TABLE', 'VIP');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('BOOKING', 'SPONSOR', 'BRANDING', 'ADMIN', 'SEAT');

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "type" "BookingType" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "companyName" TEXT,
    "ticketTier" TEXT,
    "ticketName" TEXT,
    "sponsorTier" TEXT,
    "brandingType" TEXT,
    "quantity" INTEGER NOT NULL,
    "pricePerUnit" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "seatNumbers" TEXT[],
    "tableNumber" TEXT,
    "sectionName" TEXT,
    "specialRequests" TEXT,
    "dietaryRestrictions" TEXT,
    "tablePreferences" TEXT,
    "message" TEXT,
    "adminNotes" TEXT,
    "followUpDate" TIMESTAMP(3),
    "assignedTo" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "description" TEXT,
    "status" "SponsorStatus" NOT NULL DEFAULT 'INQUIRY',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branding_opportunities" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "specifications" JSONB,
    "artworkUrl" TEXT,
    "status" "BrandingStatus" NOT NULL DEFAULT 'INQUIRY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branding_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "id" TEXT NOT NULL,
    "seatNumber" TEXT NOT NULL,
    "tableNumber" TEXT,
    "sectionName" TEXT NOT NULL,
    "seatType" "SeatType" NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "bookingId" TEXT,
    "reservedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_type_idx" ON "bookings"("type");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "bookings_customerEmail_idx" ON "bookings"("customerEmail");

-- CreateIndex
CREATE INDEX "bookings_createdAt_idx" ON "bookings"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sponsors_bookingId_key" ON "sponsors"("bookingId");

-- CreateIndex
CREATE INDEX "sponsors_status_idx" ON "sponsors"("status");

-- CreateIndex
CREATE INDEX "sponsors_displayOrder_idx" ON "sponsors"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "branding_opportunities_bookingId_key" ON "branding_opportunities"("bookingId");

-- CreateIndex
CREATE INDEX "branding_opportunities_status_idx" ON "branding_opportunities"("status");

-- CreateIndex
CREATE UNIQUE INDEX "seats_seatNumber_key" ON "seats"("seatNumber");

-- CreateIndex
CREATE INDEX "seats_sectionName_idx" ON "seats"("sectionName");

-- CreateIndex
CREATE INDEX "seats_isAvailable_idx" ON "seats"("isAvailable");

-- CreateIndex
CREATE INDEX "seats_bookingId_idx" ON "seats"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_timestamp_idx" ON "activity_logs"("timestamp");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- AddForeignKey
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branding_opportunities" ADD CONSTRAINT "branding_opportunities_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
