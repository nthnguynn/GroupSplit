-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN     "isLeft" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leftAt" TIMESTAMP(3);
