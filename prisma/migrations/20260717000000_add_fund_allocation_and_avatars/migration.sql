-- Add columns missing from initial schema that were never migrated
-- All statements use IF NOT EXISTS to be safe on any DB state

ALTER TABLE "Expense"  ADD COLUMN IF NOT EXISTS "category"      TEXT NOT NULL DEFAULT 'Khác';
ALTER TABLE "Group"    ADD COLUMN IF NOT EXISTS "avatar"         TEXT;
ALTER TABLE "Group"    ADD COLUMN IF NOT EXISTS "fundManagerId"  TEXT;
ALTER TABLE "User"     ADD COLUMN IF NOT EXISTS "avatar"         TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Group_fundManagerId_fkey') THEN
    ALTER TABLE "Group" ADD CONSTRAINT "Group_fundManagerId_fkey"
      FOREIGN KEY ("fundManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "FundAllocation" (
    "id"         TEXT              NOT NULL,
    "amount"     DOUBLE PRECISION  NOT NULL,
    "note"       TEXT,
    "date"       TIMESTAMPTZ       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"  TIMESTAMPTZ       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "groupId"    TEXT              NOT NULL,
    "fromUserId" TEXT              NOT NULL,
    "toUserId"   TEXT              NOT NULL,
    CONSTRAINT "FundAllocation_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FundAllocation_groupId_fkey') THEN
    ALTER TABLE "FundAllocation" ADD CONSTRAINT "FundAllocation_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FundAllocation_fromUserId_fkey') THEN
    ALTER TABLE "FundAllocation" ADD CONSTRAINT "FundAllocation_fromUserId_fkey"
      FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FundAllocation_toUserId_fkey') THEN
    ALTER TABLE "FundAllocation" ADD CONSTRAINT "FundAllocation_toUserId_fkey"
      FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
