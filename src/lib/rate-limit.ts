/**
 * Fixed-window Rate Limiter để chống Brute Force & DDoS.
 * Bộ đếm lưu trong Postgres (bảng RateLimit) nên dùng chung giữa mọi tiến trình/instance —
 * nếu đếm trong bộ nhớ, chạy N tiến trình thì kẻ tấn công được thử gấp N lần.
 */
import { prisma } from "@/lib/prisma";

export async function rateLimit(
  identifier: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  // Tăng bộ đếm nguyên tử; hết cửa sổ thời gian thì đếm lại từ 1
  const [record] = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${identifier}, 1, NOW() + make_interval(secs => ${windowMs / 1000}::double precision))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= NOW() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"
  `;

  // Dọn các bộ đếm đã hết hạn thỉnh thoảng (thay cho setInterval của bản trong bộ nhớ)
  if (Math.random() < 0.01) {
    prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < NOW() - INTERVAL '1 hour'`.catch(() => {});
  }

  return {
    success: record.count <= limit,
    limit,
    remaining: Math.max(0, limit - record.count),
    reset: Math.ceil(record.resetAt.getTime() / 1000),
  };
}
