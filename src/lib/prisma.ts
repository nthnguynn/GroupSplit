import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    // Khi chạy cluster (server.mjs), mỗi worker có pool riêng → server.mjs chia sẵn DB_POOL_MAX
    // để tổng số kết nối không vượt max_connections của Postgres
    max: Number(process.env.DB_POOL_MAX) || 10,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

// Lưu cả ở production: Next nạp module này riêng cho từng bundle (page, route handler...),
// không dùng chung thì mỗi bundle tạo một pool → số kết nối DB nhân lên nhiều lần.
globalForPrisma.prisma = prisma;
