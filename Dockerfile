# Stage 1: Build
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Cài đặt dependencies (postinstall chạy prisma generate → cần schema Prisma trước khi install)
COPY package.json bun.lock prisma.config.ts ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile

# Sao chép toàn bộ dự án
COPY . .

# Generate Prisma Client và build Next.js
RUN bun prisma generate
RUN bun run build

# Stage 2: Runner
FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/server.mjs ./

# Đảm bảo thư mục upload tồn tại
RUN mkdir -p public/uploads

# Chạy migrations rồi start app ở chế độ cluster (mỗi nhân CPU một worker, tối đa 16 — xem server.mjs)
# LƯU Ý: Mọi thay đổi schema phải có migration file (bun prisma migrate dev --name <tên>)
CMD ["sh", "-c", "bun prisma migrate deploy && exec bun run start:cluster"]
