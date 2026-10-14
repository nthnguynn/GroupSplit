-- AlterTable (Bổ sung cột zaloChatId an toàn cho bảng User và Group, bảo toàn 100% dữ liệu cũ)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "zaloChatId" TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "zaloChatId" TEXT;
