-- AlterTable: Add plusOneId to seats table for Plus One seat assignments
ALTER TABLE "seats" ADD COLUMN IF NOT EXISTS "plusOneId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "seats_plusOneId_idx" ON "seats"("plusOneId");
