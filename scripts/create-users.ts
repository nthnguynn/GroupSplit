import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const password = "123456";
  const passwordHash = await bcrypt.hash(password, 12);

  const users = [
    {
      username: "nguyengiangchi",
      displayName: "Nguyễn Giang Chi",
      email: "nguyengiangchi@gmail.com",
    },
    {
      username: "minhhung",
      displayName: "Minh Hưng",
      email: "minhhung@gmail.com",
    },
  ];

  for (const item of users) {
    const user = await prisma.user.upsert({
      where: { username: item.username },
      update: {
        displayName: item.displayName,
        email: item.email,
        passwordHash,
        isEmailVerified: true,
      },
      create: {
        username: item.username,
        displayName: item.displayName,
        email: item.email,
        passwordHash,
        isEmailVerified: true,
        role: "USER",
      },
    });

    console.log(`✅ [${user.username}] - "${user.displayName}" (ID: ${user.id}) đã kích hoạt mail & mật khẩu: ${password}`);
  }

  await pool.end();
  console.log("🎉 Hoàn tất thêm tài khoản!");
}

main().catch((err) => {
  console.error("❌ Lỗi:", err);
  process.exit(1);
});
