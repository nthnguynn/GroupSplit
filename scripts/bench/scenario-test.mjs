/**
 * Benchmark các kịch bản người dùng thật, gồm cả burst đồng bộ và tranh chấp ghi.
 *
 * Chuẩn bị:
 *   bun run bench:seed
 *   bun run build
 *   bun run bench:server
 *
 * Chạy toàn bộ với 1.200 người:
 *   bun run bench:scenarios
 *
 * Chạy vòng lặp chẩn đoán nhanh cho nút duyệt cùng một hóa đơn:
 *   $env:ONLY = "approve-one"; $env:USERS = "20"; bun run bench:scenarios
 *
 * Biến môi trường:
 *   BASE_URL       mặc định http://localhost:3005
 *   USERS          số request đồng bộ cho mỗi kịch bản, mặc định 1200
 *   WRITE_USERS    tải cho các nút tạo dữ liệu, mặc định bằng USERS
 *   ONLY           danh sách id kịch bản, phân cách bằng dấu phẩy
 *   MAX_P99        ngưỡng p99, mặc định 1000 ms
 *   MAX_ERR        ngưỡng lỗi ngoài dự kiến, mặc định 1%
 *   REQUEST_TIMEOUT timeout mỗi request, mặc định 60000 ms
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3005").replace(/\/$/, "");
const USERS = Math.max(1, Number(process.env.USERS ?? 1200));
const WRITE_USERS = Math.max(1, Number(process.env.WRITE_USERS ?? USERS));
const MAX_P99 = Number(process.env.MAX_P99 ?? 1000);
const MAX_ERR = Number(process.env.MAX_ERR ?? 1);
const REQUEST_TIMEOUT = Number(process.env.REQUEST_TIMEOUT ?? 60_000);
const ONLY = new Set(
  (process.env.ONLY ?? "same-page,mixed-read,create-expense,fund-contribution,settlement,mark-read,approve-one")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const ACCOUNTS = (
  process.env.BENCH_ACCOUNTS ??
  ["bench_owner", ...Array.from({ length: 9 }, (_, i) => `bench_user_${i + 1}`)]
    .map((username) => `${username}:bench123456`)
    .join(",")
)
  .split(",")
  .map((account) => {
    const [username, ...password] = account.split(":");
    return { username, password: password.join(":") };
  });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function percentile(values, value) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((value / 100) * sorted.length) - 1)];
}

function storeCookies(jar, response) {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const separator = pair.indexOf("=");
    jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

const cookieHeader = (jar) => [...jar].map(([key, value]) => `${key}=${value}`).join("; ");

async function login({ username, password }) {
  const jar = new Map();
  let response = await fetch(`${BASE_URL}/api/auth/csrf`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  storeCookies(jar, response);
  if (!response.ok) throw new Error(`GET /api/auth/csrf trả về ${response.status}`);
  const { csrfToken } = await response.json();

  response = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({ csrfToken, username, password }),
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  storeCookies(jar, response);

  const cookie = cookieHeader(jar);
  const session = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { cookie },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  }).then((result) => result.json());
  if (!session?.user?.id) throw new Error(`Đăng nhập ${username} thất bại`);
  return { username, userId: session.user.id, cookie };
}

async function request(session, path, init = {}) {
  const started = performance.now();
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(session ? { cookie: session.cookie } : {}),
        ...init.headers,
      },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text.slice(0, 300);
      }
    }
    return { status: response.status, ms: performance.now() - started, body };
  } catch (error) {
    return { status: 0, ms: performance.now() - started, error: error?.message ?? String(error) };
  }
}

function summarize(samples, expected = (sample) => sample.status >= 200 && sample.status < 300) {
  const latencies = samples.map((sample) => sample.ms);
  const unexpected = samples.filter((sample) => !expected(sample)).length;
  const statuses = {};
  for (const sample of samples) statuses[sample.status || "transport"] = (statuses[sample.status || "transport"] ?? 0) + 1;
  const errorRate = samples.length ? (unexpected / samples.length) * 100 : 100;
  return {
    requests: samples.length,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: Math.max(...latencies, 0),
    errorRate,
    statuses,
    pass: percentile(latencies, 99) <= MAX_P99 && errorRate <= MAX_ERR,
  };
}

async function synchronizedBurst(name, count, worker, expected) {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const tasks = Array.from({ length: count }, (_, index) => (async () => {
    await gate;
    return worker(index);
  })());
  await sleep(50);
  const wallStarted = performance.now();
  release();
  const samples = await Promise.all(tasks);
  const wallMs = performance.now() - wallStarted;
  const summary = { name, concurrency: count, wallMs, ...summarize(samples, expected) };
  return { samples, summary };
}

function printSummary(result) {
  const value = result.summary;
  const verdict = value.pass ? "ĐẠT" : "KHÔNG ĐẠT";
  console.log(
    `${verdict.padEnd(10)} ${value.name.padEnd(35)} ` +
      `p50 ${Math.round(value.p50)}ms  p95 ${Math.round(value.p95)}ms  ` +
      `p99 ${Math.round(value.p99)}ms  lỗi ${value.errorRate.toFixed(1)}%  ` +
      `wall ${(value.wallMs / 1000).toFixed(1)}s`
  );
  console.log(`           HTTP ${JSON.stringify(value.statuses)}`);
}

async function main() {
  console.log(`🎯 ${BASE_URL} — ${USERS} người cùng bắt đầu`);
  console.log(`   Ghi đồng thời: ${WRITE_USERS} · đạt khi p99 ≤ ${MAX_P99}ms và lỗi ngoài dự kiến ≤ ${MAX_ERR}%`);
  console.log(`   Kịch bản: ${[...ONLY].join(", ")}\n`);

  const sessions = await Promise.all(ACCOUNTS.map(login));
  const owner = sessions.find((session) => session.username === "bench_owner") ?? sessions[0];
  const groupsResponse = await request(owner, "/api/groups");
  const group = Array.isArray(groupsResponse.body)
    ? groupsResponse.body.find((item) => item.name?.startsWith("[BENCH]"))
    : null;
  if (!group) throw new Error('Không tìm thấy nhóm [BENCH] — chạy "bun run bench:seed" trước');
  const activeMembers = group.members.filter((member) => !member.isLeft);
  const sessionByUserId = new Map(sessions.map((session) => [session.userId, session]));
  const memberSessions = activeMembers
    .filter((member) => member.userId !== group.ownerId)
    .map((member) => sessionByUserId.get(member.userId))
    .filter(Boolean);
  if (!memberSessions.length) throw new Error("Nhóm benchmark cần ít nhất một thành viên ngoài trưởng nhóm");
  console.log(`🔑 ${sessions.length} phiên đăng nhập · nhóm ${group.id} · ${activeMembers.length} thành viên\n`);

  const results = [];
  let pendingExpense = null;
  let pendingCreator = memberSessions[0];

  if (ONLY.has("same-page")) {
    const result = await synchronizedBurst(
      "Cùng mở nút Chi tiêu",
      USERS,
      (index) => request(sessions[index % sessions.length], `/groups/${group.id}?tab=expenses`)
    );
    results.push(result.summary);
    printSummary(result);
  }

  if (ONLY.has("mixed-read")) {
    const firstMember = activeMembers.find((member) => member.userId !== group.ownerId)?.userId;
    const paths = [
      "/groups",
      "/dashboard",
      "/api/notifications",
      `/api/groups/${group.id}/categories`,
      `/groups/${group.id}?tab=expenses`,
      `/groups/${group.id}?tab=settle`,
      `/groups/${group.id}?tab=group-fund`,
      `/groups/${group.id}?tab=funds`,
      `/groups/${group.id}?tab=members`,
      `/groups/${group.id}?tab=settings`,
      `/api/groups/${group.id}/debt-breakdown?a=${encodeURIComponent(group.ownerId)}&b=${encodeURIComponent(firstMember)}`,
    ];
    const result = await synchronizedBurst(
      "Hỗn hợp toàn bộ màn hình đọc",
      USERS,
      (index) => request(sessions[index % sessions.length], paths[index % paths.length])
    );
    results.push(result.summary);
    printSummary(result);
  }

  if (ONLY.has("create-expense")) {
    const result = await synchronizedBurst("Cùng bấm Thêm hóa đơn", WRITE_USERS, async (index) => {
      const session = memberSessions[index % memberSessions.length];
      const amount = 100_000 + index;
      return request(session, `/api/groups/${group.id}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          title: `[BENCH-BURST] Hóa đơn ${Date.now()}-${index}`,
          description: "Sinh tự động bởi scenario benchmark",
          amount,
          paidById: session.userId,
          splitType: "EQUAL",
          category: "Khác",
          fundingSource: "MEMBER",
          splits: activeMembers.map((member) => ({
            userId: member.userId,
            amount: Math.round(amount / activeMembers.length),
            shares: 1,
          })),
        }),
      });
    });
    pendingExpense = result.samples.find((sample) => sample.status === 201)?.body ?? null;
    if (pendingExpense?.createdById) {
      pendingCreator = sessionByUserId.get(pendingExpense.createdById) ?? pendingCreator;
    }
    results.push(result.summary);
    printSummary(result);
  }

  if (ONLY.has("fund-contribution")) {
    const result = await synchronizedBurst("Cùng bấm Góp quỹ", WRITE_USERS, (index) => {
      const session = memberSessions[index % memberSessions.length];
      return request(session, `/api/groups/${group.id}/fund-contributions`, {
        method: "POST",
        body: JSON.stringify({ amount: 10_000 + index, note: `[BENCH-BURST] ${index}` }),
      });
    });
    results.push(result.summary);
    printSummary(result);
  }

  if (ONLY.has("settlement")) {
    const result = await synchronizedBurst("Cùng bấm Đã chuyển tiền", WRITE_USERS, (index) => {
      const session = memberSessions[index % memberSessions.length];
      return request(session, `/api/groups/${group.id}/settlements`, {
        method: "POST",
        body: JSON.stringify({
          fromUserId: session.userId,
          toUserId: group.ownerId,
          amount: 20_000 + index,
          note: `[BENCH-BURST] ${index}`,
        }),
      });
    });
    results.push(result.summary);
    printSummary(result);
  }

  if (ONLY.has("mark-read")) {
    const result = await synchronizedBurst("Cùng bấm Đánh dấu đã đọc", USERS, (index) =>
      request(sessions[index % sessions.length], "/api/notifications", {
        method: "PATCH",
        body: JSON.stringify({ markAll: true }),
      })
    );
    results.push(result.summary);
    printSummary(result);
  }

  if (ONLY.has("approve-one")) {
    if (!pendingExpense?.id) {
      pendingCreator = memberSessions[0];
      const amount = 123_456;
      const setup = await request(pendingCreator, `/api/groups/${group.id}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          title: `[BENCH-COLLISION] ${Date.now()}`,
          amount,
          paidById: pendingCreator.userId,
          splitType: "EQUAL",
          category: "Khác",
          fundingSource: "MEMBER",
          splits: activeMembers.map((member) => ({
            userId: member.userId,
            amount: Math.round(amount / activeMembers.length),
            shares: 1,
          })),
        }),
      });
      if (setup.status !== 201) throw new Error(`Không tạo được hóa đơn chờ duyệt: HTTP ${setup.status}`);
      pendingExpense = setup.body;
    }

    const result = await synchronizedBurst("Cùng duyệt MỘT hóa đơn", USERS, () =>
      request(owner, `/api/expenses/${pendingExpense.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "APPROVED" }),
      })
    );
    const notificationResponse = await request(pendingCreator, "/api/notifications");
    const matchingNotifications = Array.isArray(notificationResponse.body?.notifications)
      ? notificationResponse.body.notifications.filter(
          (notification) => notification.entityId === pendingExpense.id && notification.type === "EXPENSE_APPROVED"
        ).length
      : 0;
    result.summary.correctness = {
      expectedNotifications: 1,
      observedInLatest30: matchingNotifications,
      pass: matchingNotifications === 1,
    };
    result.summary.pass = result.summary.pass && result.summary.correctness.pass;
    results.push(result.summary);
    printSummary(result);
    console.log(
      `           Tính đúng: ${matchingNotifications === 1 ? "ĐẠT" : "LỖI"} — ` +
        `${matchingNotifications} thông báo trùng trong 30 thông báo mới nhất (mong đợi 1)`
    );
  }

  const passed = results.filter((result) => result.pass).length;
  const outputDirectory = join(dirname(fileURLToPath(import.meta.url)), "results");
  mkdirSync(outputDirectory, { recursive: true });
  const outputFile = join(outputDirectory, `scenarios-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(
    outputFile,
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        users: USERS,
        writeUsers: WRITE_USERS,
        maxP99: MAX_P99,
        maxErr: MAX_ERR,
        groupId: group.id,
        passed,
        total: results.length,
        results,
      },
      null,
      2
    )
  );
  console.log(`\n📊 ${passed}/${results.length} kịch bản đạt`);
  console.log(`💾 Kết quả chi tiết: ${outputFile}`);
  if (passed !== results.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`❌ ${error?.stack ?? error}`);
  process.exit(1);
});
