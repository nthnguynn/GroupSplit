/**
 * Tạo nhanh nhiều tài khoản USER đã kích hoạt (không cần xác thực email).
 *
 * Cách dùng (trong container app, xem hướng dẫn cuối file):
 *   bun add-users.mjs manh quy trung              → tên hiển thị = tên đăng nhập
 *   bun add-users.mjs "manh:Mạnh" "quy:Quý"       → tên đăng nhập:tên hiển thị
 *   bun add-users.mjs --password=MatKhauChung manh quy
 *
 * Mặc định mỗi người một mật khẩu ngẫu nhiên, in ra cuối để gửi cho từng người.
 * Tài khoản đã tồn tại sẽ được bỏ qua (không ghi đè mật khẩu).
 */
import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const args = process.argv.slice(2);
const sharedPassword = args.find((a) => a.startsWith("--password="))?.slice("--password=".length);
const entries = args
  .filter((a) => !a.startsWith("--"))
  .map((a) => {
    const [username, ...name] = a.split(":");
    return { username: username.trim().toLowerCase(), displayName: name.join(":").trim() || username.trim() };
  })
  .filter((e) => e.username);

if (!entries.length) {
  console.log('Cách dùng: bun add-users.mjs "manh:Mạnh" "quy:Quý" ... [--password=MatKhauChung]');
  process.exit(1);
}

// Bỏ các ký tự dễ nhầm (0/O, 1/l/I) để đọc mật khẩu cho người khác không bị sai
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
const randomPassword = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const results = [];
try {
  for (const { username, displayName } of entries) {
    const { rowCount } = await client.query(`SELECT 1 FROM "User" WHERE username = $1`, [username]);
    if (rowCount) {
      results.push({ username, displayName, password: "(đã tồn tại — bỏ qua)" });
      continue;
    }
    const password = sharedPassword || randomPassword();
    await client.query(
      `INSERT INTO "User" (id, username, "displayName", "passwordHash", role, "isEmailVerified")
       VALUES ($1, $2, $3, $4, 'USER', true)`,
      [randomUUID(), username, displayName, await bcrypt.hash(password, 10)]
    );
    results.push({ username, displayName, password });
  }
} finally {
  await client.end();
}

console.log("\nTên đăng nhập  | Tên hiển thị    | Mật khẩu");
console.log("---------------+-----------------+----------------------");
for (const r of results) console.log(`${r.username.padEnd(14)} | ${r.displayName.padEnd(15)} | ${r.password}`);
console.log("\nĐổi mật khẩu sau này: Admin → tab Người dùng → Đặt lại mật khẩu.");
