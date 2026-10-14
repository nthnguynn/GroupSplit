import bcrypt from "bcryptjs";

/**
 * bcrypt cost 10 — mức tối thiểu OWASP khuyến nghị. Cost 12 tốn ~0,5 giây CPU mỗi lần
 * kiểm tra (bcryptjs chạy JS thuần), làm đăng nhập chậm rõ rệt; cost 10 nhanh gấp 4 lần.
 */
export const BCRYPT_COST = 10;

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);

export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/** Hash tạo với cost khác (vd. cost 12 cũ) → nên băm lại sau khi đăng nhập thành công */
export const needsRehash = (hash: string) => bcrypt.getRounds(hash) !== BCRYPT_COST;
