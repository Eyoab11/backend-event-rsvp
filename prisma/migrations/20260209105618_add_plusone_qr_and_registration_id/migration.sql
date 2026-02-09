/*
  Warnings:

  - A unique constraint covering the columns `[qrCode]` on the table `plus_ones` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[registrationId]` on the table `plus_ones` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `qrCode` to the `plus_ones` table without a default value. This is not possible if the table is not empty.
  - Added the required column `registrationId` to the `plus_ones` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add columns with temporary default values
ALTER TABLE "plus_ones" ADD COLUMN "qrCode" TEXT;
ALTER TABLE "plus_ones" ADD COLUMN "registrationId" TEXT;

-- Step 2: Generate unique values for existing rows using md5 hash
UPDATE "plus_ones" 
SET "qrCode" = md5(random()::text || clock_timestamp()::text || id),
    "registrationId" = 'PLUSONE-' || EXTRACT(EPOCH FROM NOW())::TEXT || '-' || SUBSTRING(id, 1, 8)
WHERE "qrCode" IS NULL OR "registrationId" IS NULL;

-- Step 3: Make columns NOT NULL
ALTER TABLE "plus_ones" ALTER COLUMN "qrCode" SET NOT NULL;
ALTER TABLE "plus_ones" ALTER COLUMN "registrationId" SET NOT NULL;

-- Step 4: Create unique indexes
CREATE UNIQUE INDEX "plus_ones_qrCode_key" ON "plus_ones"("qrCode");
CREATE UNIQUE INDEX "plus_ones_registrationId_key" ON "plus_ones"("registrationId");
