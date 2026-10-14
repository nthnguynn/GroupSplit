import { createHmac, timingSafeEqual } from "crypto";

/**
 * Vé đăng nhập ngắn hạn: /api/auth/login-check cấp sau khi đã kiểm tra captcha + mật khẩu,
 * rồi signIn("credentials") dùng vé này thay vì gửi lại mật khẩu — tránh chạy bcrypt lần 2
 * (mỗi lần ~0,1–0,5 giây CPU). Vé = "<userId>.<hết hạn>.<HMAC>", ký bằng AUTH_SECRET, sống 60 giây.
 */
const TTL_MS = 60 * 1000;

function sign(payload: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Thiếu AUTH_SECRET / NEXTAUTH_SECRET");
  // Tiền tố riêng để chữ ký này không dùng lẫn được với HMAC khác ký cùng secret (vd. captcha)
  return createHmac("sha256", secret).update(`login-ticket:${payload}`).digest("base64url");
}

export function createLoginTicket(userId: string) {
  const payload = `${userId}.${Date.now() + TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

/** Trả về userId nếu vé hợp lệ và còn hạn, ngược lại null */
export function verifyLoginTicket(ticket: string): string | null {
  const parts = ticket.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, signature] = parts;

  const actual = Buffer.from(signature);
  const expected = Buffer.from(sign(`${userId}.${expiresAt}`));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  if (!(Number(expiresAt) > Date.now())) return null;
  return userId;
}
