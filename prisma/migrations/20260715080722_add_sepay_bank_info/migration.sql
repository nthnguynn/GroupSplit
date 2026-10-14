-- AlterTable
ALTER TABLE "User" ADD COLUMN "accountName" TEXT;
ALTER TABLE "User" ADD COLUMN "accountNumber" TEXT;
ALTER TABLE "User" ADD COLUMN "bankName" TEXT;
ALTER TABLE "User" ADD COLUMN "sepayWebhookSecret" TEXT;

-- CreateTable
CREATE TABLE "SepayTransaction" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "transactionDate" TIMESTAMPTZ NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "transferType" TEXT NOT NULL,
    "transferAmount" DOUBLE PRECISION NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SepayTransaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SepayTransaction" ADD CONSTRAINT "SepayTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
