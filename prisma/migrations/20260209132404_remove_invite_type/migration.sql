/*
  Warnings:

  - You are about to drop the column `inviteType` on the `invites` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "invites" DROP COLUMN "inviteType";

-- DropEnum
DROP TYPE "InviteType";
