-- AlterTable
ALTER TABLE "User" ADD COLUMN     "zaloLinkCode" TEXT,
ADD COLUMN     "zaloLinkCodeExpires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_zaloLinkCode_key" ON "User"("zaloLinkCode");
