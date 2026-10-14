import type { Prisma } from "@prisma/client";

/**
 * Các trường User an toàn để gửi xuống client.
 * KHÔNG dùng `user: true` cho dữ liệu trả về client — sẽ lộ passwordHash,
 * passwordResetToken, sepayWebhookSecret... của thành viên khác.
 */
export const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatar: true,
} satisfies Prisma.UserSelect;

/** Thêm thông tin ngân hàng — chỉ dùng cho thành viên cùng nhóm (tạo QR chuyển khoản). */
export const memberUserSelect = {
  ...publicUserSelect,
  bankName: true,
  accountNumber: true,
  accountName: true,
} satisfies Prisma.UserSelect;
