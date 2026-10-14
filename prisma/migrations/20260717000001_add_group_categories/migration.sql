-- =============================================================
-- Idempotent migration: Create Category table and link to Expense
-- =============================================================

-- 1. Create Category Table if not exists
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📦',
    "parentId" TEXT,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- 2. Add categoryId column to Expense if not exists
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

-- 3. Add foreign key constraints safely
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Category_parentId_fkey') THEN
    ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Category_groupId_fkey') THEN
    ALTER TABLE "Category" ADD CONSTRAINT "Category_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_categoryId_fkey') THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Seed default categories for all existing groups
DO $$
DECLARE
    grp RECORD;
BEGIN
    FOR grp IN SELECT id FROM "Group" LOOP
        -- Insert "Ăn uống"
        INSERT INTO "Category" (id, name, icon, "groupId")
        VALUES ('cat_' || grp.id || '_anuong', 'Ăn uống', '🍽️', grp.id)
        ON CONFLICT DO NOTHING;

        -- Insert "Di chuyển"
        INSERT INTO "Category" (id, name, icon, "groupId")
        VALUES ('cat_' || grp.id || '_dichuyen', 'Di chuyển', '🚗', grp.id)
        ON CONFLICT DO NOTHING;

        -- Insert "Mua sắm"
        INSERT INTO "Category" (id, name, icon, "groupId")
        VALUES ('cat_' || grp.id || '_muasam', 'Mua sắm', '🛒', grp.id)
        ON CONFLICT DO NOTHING;

        -- Insert "Giải trí"
        INSERT INTO "Category" (id, name, icon, "groupId")
        VALUES ('cat_' || grp.id || '_giaitri', 'Giải trí', '🎉', grp.id)
        ON CONFLICT DO NOTHING;

        -- Insert "Sinh hoạt"
        INSERT INTO "Category" (id, name, icon, "groupId")
        VALUES ('cat_' || grp.id || '_sinhhoat', 'Sinh hoạt', '🏠', grp.id)
        ON CONFLICT DO NOTHING;

        -- Insert "Khác"
        INSERT INTO "Category" (id, name, icon, "groupId")
        VALUES ('cat_' || grp.id || '_khac', 'Khác', '📦', grp.id)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- 5. Map existing expenses to their respective new categories
UPDATE "Expense" 
SET "categoryId" = 'cat_' || "groupId" || '_anuong'
WHERE category = 'Ăn uống' AND "categoryId" IS NULL;

UPDATE "Expense" 
SET "categoryId" = 'cat_' || "groupId" || '_dichuyen'
WHERE category = 'Di chuyển' AND "categoryId" IS NULL;

UPDATE "Expense" 
SET "categoryId" = 'cat_' || "groupId" || '_muasam'
WHERE category = 'Mua sắm' AND "categoryId" IS NULL;

UPDATE "Expense" 
SET "categoryId" = 'cat_' || "groupId" || '_giaitri'
WHERE category = 'Giải trí' AND "categoryId" IS NULL;

UPDATE "Expense" 
SET "categoryId" = 'cat_' || "groupId" || '_sinhhoat'
WHERE category = 'Sinh hoạt' AND "categoryId" IS NULL;

UPDATE "Expense" 
SET "categoryId" = 'cat_' || "groupId" || '_khac'
WHERE "categoryId" IS NULL;
