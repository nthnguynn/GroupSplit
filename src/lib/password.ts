import bcrypt from "bcryptjs";

/**
 * bcrypt cost 10 — mức tối thiểu OWASP khuyến nghị. Cost 12 tốn ~0,5 giây CPU mỗi lần
 * kiểm tra (bcryptjs chạy JS thuần), làm đăng nhập chậm rõ rệt; cost 10 nhanh gấp 4 lần.
 */
export const BCRYPT_COST = 10;

/**
 * Image Docker chạy app bằng Bun: Bun.password băm bcrypt bằng code native trên thread pool,
 * không chiếm luồng chính như bcryptjs (đo 1 tiến trình: ~87 so với ~10 lượt/giây).
 * Hash hai bên đọc được của nhau ($2a$/$2b$), nên không phải băm lại mật khẩu cũ.
 * Ngoại lệ: mật khẩu dài hơn 72 byte bị Bun băm SHA-512 trước, không khớp hash của bcryptjs → dùng bcryptjs.
 * Chạy bằng Node (next dev) thì không có Bun → dùng bcryptjs như cũ.
 */
type BunPassword = {
  hash(password: string, options: { algorithm: "bcrypt"; cost: number }): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
};
const bunPassword = (globalThis as { Bun?: { password?: BunPassword } }).Bun?.password;
const canHashNatively = (password: string) => !!bunPassword && Buffer.byteLength(password, "utf8") <= 72;

export const hashPassword = (password: string) =>
  canHashNatively(password)
    ? bunPassword!.hash(password, { algorithm: "bcrypt", cost: BCRYPT_COST })
    : bcrypt.hash(password, BCRYPT_COST);

export const verifyPassword = async (password: string, hash: string) => {
  if (canHashNatively(password)) {
    try {
      return await bunPassword!.verify(password, hash);
    } catch {
      // Hash không đúng định dạng Bun nhận → để bcryptjs xử lý như trước
    }
  }
  return bcrypt.compare(password, hash);
};

/** Hash tạo với cost khác (vd. cost 12 cũ) → nên băm lại sau khi đăng nhập thành công */
export const needsRehash = (hash: string) => bcrypt.getRounds(hash) !== BCRYPT_COST;
