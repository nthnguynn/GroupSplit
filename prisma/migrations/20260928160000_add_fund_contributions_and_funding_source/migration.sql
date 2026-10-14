-- AlterTable Expense
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "fundingSource" TEXT NOT NULL DEFAULT 'MEMBER';

-- CreateTable FundContribution
CREATE TABLE IF NOT EXISTS "FundContribution" (
    "id"          TEXT             NOT NULL,
    "amount"      DOUBLE PRECISION NOT NULL,
    "note"        TEXT,
    "status"      TEXT             NOT NULL DEFAULT 'PENDING',
    "createdAt"   TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMPTZ,
    "groupId"     TEXT             NOT NULL,
    "userId"      TEXT             NOT NULL,
    CONSTRAINT "FundContribution_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FundContribution_groupId_fkey') THEN
    ALTER TABLE "FundContribution" ADD CONSTRAINT "FundContribution_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FundContribution_userId_fkey') THEN
    ALTER TABLE "FundContribution" ADD CONSTRAINT "FundContribution_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
