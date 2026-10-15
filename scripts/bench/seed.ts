/**
 * Seed dữ liệu cho load test: tạo user bench_owner + các thành viên,
 * một nhóm "[BENCH]" với nhiều khoản chi, splits, thanh toán và thông báo.
 *
 * Chạy:  bun run bench:seed
 * Tùy chỉnh: BENCH_MEMBERS=20 BENCH_EXPENSES=5000 bun run bench:seed
 *   BENCH_DAYS=90          rải hóa đơn đều trong 90 ngày (mặc định: mỗi giờ 1 hóa đơn)
 *   BENCH_PENDING_EVERY=100 cứ 100 hóa đơn có 1 chờ duyệt (mặc định 10)
 * Bộ dữ liệu sát thực tế: BENCH_EXPENSES=300 BENCH_DAYS=90 BENCH_PENDING_EVERY=100 bun run bench:seed
 * Chạy lại sẽ xóa nhóm [BENCH] cũ và tạo mới.
 */
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

const MEMBERS = Math.max(2, Number(process.env.BENCH_MEMBERS ?? 10));
const EXPENSES = Math.max(1, Number(process.env.BENCH_EXPENSES ?? 1000));
const DAYS = Number(process.env.BENCH_DAYS ?? 0);
const PENDING_EVERY = Math.max(1, Number(process.env.BENCH_PENDING_EVERY ?? 10));
const STEP_MS = DAYS > 0 ? (DAYS * 24 * 60 * 60 * 1000) / EXPENSES : 60 * 60 * 1000;
const SETTLEMENTS = 30;
const NOTIFICATIONS = 60;
const PASSWORD = "bench123456";
const GROUP_NAME = "[BENCH] Nhóm load test";
const CATEGORIES = ["Ăn uống", "Di chuyển", "Nhà ở", "Giải trí", "Mua sắm", "Khác"];

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function deleteBenchGroup(groupId: string) {
  await prisma.$transaction([
    prisma.expenseSplit.deleteMany({ where: { expense: { groupId } } }),
    prisma.expense.deleteMany({ where: { groupId } }),
    prisma.settlement.deleteMany({ where: { groupId } }),
    prisma.fundAllocation.deleteMany({ where: { groupId } }),
    prisma.groupMember.deleteMany({ where: { groupId } }),
    prisma.group.delete({ where: { id: groupId } }),
  ]);
}

async function main() {
  const started = Date.now();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // 1. Users
  const users: { id: string }[] = [];
  for (let i = 0; i < MEMBERS; i++) {
    const username = i === 0 ? "bench_owner" : `bench_user_${i}`;
    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash, isEmailVerified: true },
      create: {
        username,
        displayName: i === 0 ? "Bench Owner" : `Bench User ${i}`,
        passwordHash,
        isEmailVerified: true,
        role: "USER",
      },
    });
    users.push(user);
  }
  const owner = users[0];
  console.log(`✅ ${users.length} user (mật khẩu: ${PASSWORD})`);

  // 2. Xóa nhóm bench cũ
  const oldGroups = await prisma.group.findMany({
    where: { name: GROUP_NAME, ownerId: owner.id },
    select: { id: true },
  });
  for (const g of oldGroups) await deleteBenchGroup(g.id);
  if (oldGroups.length) console.log(`🧹 Đã xóa ${oldGroups.length} nhóm [BENCH] cũ`);

  // 3. Nhóm + thành viên
  const group = await prisma.group.create({
    data: {
      name: GROUP_NAME,
      description: "Dữ liệu giả lập cho load test",
      ownerId: owner.id,
      members: {
        create: users.map((u, i) => ({
          userId: u.id,
          role: i === 0 ? ("OWNER" as const) : ("MEMBER" as const),
        })),
      },
    },
  });

  // 4. Khoản chi + splits chia đều
  const now = Date.now();
  const expenseData = Array.from({ length: EXPENSES }, (_, i) => {
    const payer = users[i % MEMBERS];
    const date = new Date(now - i * STEP_MS);
    return {
      title: `Chi tiêu #${i + 1}`,
      amount: (Math.floor(Math.random() * 1950) + 50) * 1000,
      groupId: group.id,
      paidById: payer.id,
      createdById: payer.id,
      status: i % PENDING_EVERY === 0 ? ("PENDING" as const) : ("APPROVED" as const),
      category: CATEGORIES[i % CATEGORIES.length],
      date,
      createdAt: date,
    };
  });

  const expenses: { id: string; amount: number }[] = [];
  for (const batch of chunk(expenseData, 1000)) {
    expenses.push(
      ...(await prisma.expense.createManyAndReturn({
        data: batch,
        select: { id: true, amount: true },
      }))
    );
  }

  const splitData = expenses.flatMap((e) =>
    users.map((u) => ({
      expenseId: e.id,
      userId: u.id,
      amount: Math.round(e.amount / MEMBERS),
    }))
  );
  for (const batch of chunk(splitData, 5000)) {
    await prisma.expenseSplit.createMany({ data: batch });
  }
  console.log(`✅ ${expenses.length} khoản chi, ${splitData.length} splits`);

  // 5. Thanh toán
  await prisma.settlement.createMany({
    data: Array.from({ length: SETTLEMENTS }, (_, i) => ({
      groupId: group.id,
      fromUserId: users[(i % (MEMBERS - 1)) + 1].id,
      toUserId: owner.id,
      amount: (Math.floor(Math.random() * 500) + 10) * 1000,
      isConfirmed: i % 3 !== 0,
    })),
  });

  // 6. Thông báo cho bench_owner
  await prisma.notification.deleteMany({ where: { userId: owner.id } });
  await prisma.notification.createMany({
    data: Array.from({ length: NOTIFICATIONS }, (_, i) => ({
      userId: owner.id,
      title: `Thông báo #${i + 1}`,
      content: "Thông báo giả lập cho load test",
      type: "EXPENSE_APPROVED" as const,
      status: i % 2 === 0 ? ("UNREAD" as const) : ("READ" as const),
      link: `/groups/${group.id}`,
      entityId: expenses[i % expenses.length].id,
    })),
  });
  console.log(`✅ ${SETTLEMENTS} thanh toán, ${NOTIFICATIONS} thông báo`);

  await pool.end();
  console.log(`🎉 Xong trong ${((Date.now() - started) / 1000).toFixed(1)}s — group id: ${group.id}`);
}

main().catch(async (err) => {
  console.error("❌ Lỗi:", err);
  await pool.end();
  process.exit(1);
});
