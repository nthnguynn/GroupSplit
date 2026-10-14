/**
 * Tạo tài khoản Admin đầu tiên khi container khởi động (chạy sau `prisma migrate deploy`).
 * Chỉ tạo khi DB CHƯA có tài khoản ADMIN nào — có rồi thì không làm gì.
 *
 *   ADMIN_USERNAME  tên đăng nhập, mặc định "admin"
 *   ADMIN_PASSWORD  mật khẩu — bắt buộc để tạo (không đặt thì bỏ qua)
 *
 * Mật khẩu đặt trong .env trên server, không nằm trong code (repo có thể public).
 * Đổi mật khẩu sau khi đăng nhập: trang Admin → Người dùng → Reset Pass.
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const username = (process.env.ADMIN_USERNAME || "admin").trim();
const password = process.env.ADMIN_PASSWORD || "";

if (!password) {
  console.log("> Bỏ qua tạo Admin: chưa đặt ADMIN_PASSWORD");
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const { rowCount: adminCount } = await client.query(`SELECT 1 FROM "User" WHERE role = 'ADMIN' LIMIT 1`);
  if (adminCount) {
    console.log("> Đã có tài khoản Admin — không tạo thêm");
  } else {
    const { rowCount: taken } = await client.query(`SELECT 1 FROM "User" WHERE username = $1`, [username]);
    if (taken) {
      // Không nâng quyền tài khoản người khác đã đăng ký trùng tên
      console.warn(`> Không tạo Admin: username "${username}" đã có người đăng ký — đặt ADMIN_USERNAME khác`);
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await client.query(
        `INSERT INTO "User" (id, username, "displayName", "passwordHash", role, "isEmailVerified")
         VALUES ($1, $2, $3, $4, 'ADMIN', true)`,
        [randomUUID(), username, "Quản trị viên", passwordHash]
      );
      console.log(`> Đã tạo tài khoản Admin "${username}"`);
    }
  }
} catch (err) {
  // Lỗi tạo Admin không được chặn app khởi động
  console.error("> Lỗi tạo tài khoản Admin:", err.message);
} finally {
  await client.end().catch(() => {});
}
