/**
 * Đo số NGƯỜI DÙNG ĐỒNG THỜI hệ thống chịu được.
 * Mỗi người ảo dùng một phiên đăng nhập sẵn và lặp lại: mở 1 trang → nghỉ như người thật đang đọc.
 * Tăng dần số người ảo theo bậc; mỗi bậc giữ HOLD giây; dừng khi p99 > MAX_P99 hoặc lỗi > MAX_ERR.
 *
 * Chuẩn bị:
 *   1. Dữ liệu sát thực tế: BENCH_EXPENSES=300 BENCH_DAYS=90 BENCH_PENDING_EVERY=100 bun run bench:seed
 *   2. Server production đang chạy. Dùng bench:server hoặc container Docker để đo
 *      đúng cấu hình Portainer; bench:server:single chỉ dùng để lấy baseline 1 CPU.
 * Chạy:
 *   bun run bench:users
 *
 * Tùy chỉnh qua biến môi trường:
 *   BASE_URL              mặc định http://localhost:3005
 *   STAGES                số người ảo mỗi bậc, mặc định "100,200,400,600,800,1000,1200,1500,2000"
 *   HOLD                  số giây đo mỗi bậc, mặc định 30
 *   THINK_MIN, THINK_MAX  thời gian nghỉ giữa 2 lần mở trang (giây), mặc định 5 và 15
 *   MAX_P99, MAX_ERR      ngưỡng đạt, mặc định 1000 ms và 1 %
 *   BENCH_ACCOUNTS        "user:mật khẩu,..." — mặc định 10 tài khoản do bench:seed tạo
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3005").replace(/\/$/, "");
const STAGES = [...new Set((process.env.STAGES ?? "100,200,400,600,800,1000,1200,1500,2000")
  .split(",")
  .map(Number)
  .filter((n) => n > 0))].sort((a, b) => a - b);
const HOLD = Number(process.env.HOLD ?? 30);
const THINK_MIN = Number(process.env.THINK_MIN ?? 5);
const THINK_MAX = Number(process.env.THINK_MAX ?? 15);
const MAX_P99 = Number(process.env.MAX_P99 ?? 1000);
const MAX_ERR = Number(process.env.MAX_ERR ?? 1);
const ACCOUNTS = (
  process.env.BENCH_ACCOUNTS ??
  ["bench_owner", ...Array.from({ length: 9 }, (_, i) => `bench_user_${i + 1}`)].map((u) => `${u}:bench123456`).join(",")
)
  .split(",")
  .map((a) => {
    const [username, ...rest] = a.split(":");
    return { username, password: rest.join(":") };
  });

// Tỉ lệ các trang một người dùng mở (tổng = 1)
const ACTIONS = [
  { name: "Trang chi tiết nhóm", weight: 0.4, path: (s) => `/groups/${s.groupId}` },
  { name: "Dashboard", weight: 0.3, path: () => "/dashboard" },
  { name: "API thông báo", weight: 0.2, path: () => "/api/notifications" },
  { name: "Danh sách nhóm", weight: 0.1, path: () => "/groups" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const thinkMs = () => (THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN)) * 1000;
function pickAction() {
  let x = Math.random();
  for (const a of ACTIONS) if ((x -= a.weight) <= 0) return a;
  return ACTIONS.at(-1);
}
function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function login({ username, password }) {
  const jar = new Map();
  const store = (r) => {
    for (const c of r.headers.getSetCookie()) {
      const pair = c.split(";")[0];
      const idx = pair.indexOf("=");
      jar.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
  };
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

  let res = await fetch(`${BASE_URL}/api/auth/csrf`);
  store(res);
  const { csrfToken } = await res.json();
  res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ csrfToken, username, password }),
    redirect: "manual",
  });
  store(res);

  const cookie = cookieHeader();
  const groups = await (await fetch(`${BASE_URL}/api/groups`, { headers: { cookie } })).json();
  if (!Array.isArray(groups) || !groups.length) {
    throw new Error(`Đăng nhập ${username} thất bại hoặc chưa có nhóm — chạy "bun run bench:seed" trước`);
  }
  return { cookie, groupId: groups[0].id };
}

let stats = null; // số liệu của bậc đang đo; null = đang chờ người dùng vào nhịp
let running = true;

async function virtualUser(session, startDelayMs) {
  await sleep(startDelayMs);
  while (running) {
    const action = pickAction();
    // Giữ đúng bucket tại lúc request bắt đầu. Nếu đọc biến `stats` lúc request
    // kết thúc, request chậm có thể bị rơi khỏi bậc hiện tại hoặc lọt sang bậc kế.
    const sample = stats;
    if (sample) sample.inFlight++;
    const t0 = performance.now();
    let ok = false;
    try {
      const res = await fetch(BASE_URL + action.path(session), {
        headers: { cookie: session.cookie },
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
      await res.arrayBuffer();
      ok = res.status === 200;
    } catch {
      ok = false;
    }
    const ms = performance.now() - t0;
    if (sample) {
      sample.latencies.push(ms);
      if (!ok) sample.errors++;
      (sample.byAction[action.name] ??= []).push(ms);
      sample.inFlight--;
    }
    await sleep(thinkMs());
  }
}

async function waitForMeasuredRequests(sample) {
  // Mỗi fetch có timeout 30 giây. Chờ các request đã bắt đầu trong cửa sổ đo
  // hoàn tất để p95/p99 không bị đẹp giả khi server đang nghẽn.
  const deadline = Date.now() + 31_000;
  while (sample.inFlight > 0 && Date.now() < deadline) await sleep(25);
  return sample.inFlight === 0;
}

const ms = (v) => `${Math.round(v)}ms`;

async function main() {
  console.log(`🎯 ${BASE_URL} — bậc [${STAGES.join(", ")}] người, đo ${HOLD}s/bậc`);
  console.log(`   Mỗi người nghỉ ${THINK_MIN}–${THINK_MAX}s giữa 2 lần mở trang · đạt: p99 ≤ ${MAX_P99}ms và lỗi ≤ ${MAX_ERR}%\n`);

  const sessions = [];
  for (const account of ACCOUNTS) sessions.push(await login(account));
  console.log(`🔑 ${sessions.length} tài khoản đã đăng nhập\n`);
  console.log("Người dùng  Lượt/giây  p50      p95      p99      Lỗi %   Kết quả");
  console.log("-".repeat(70));

  const results = [];
  let users = 0;
  for (const target of STAGES) {
    // Thêm người mới, rải thời điểm bắt đầu để không dồn vào cùng một giây
    for (; users < target; users++) virtualUser(sessions[users % sessions.length], Math.random() * THINK_MAX * 1000);
    await sleep(THINK_MAX * 1000); // chờ người mới vào nhịp rồi mới đo

    stats = { latencies: [], errors: 0, byAction: {}, inFlight: 0 };
    const t0 = Date.now();
    await sleep(HOLD * 1000);
    const s = stats;
    stats = null;
    const seconds = (Date.now() - t0) / 1000;
    const drained = await waitForMeasuredRequests(s);
    if (!drained) console.warn(`  ⚠ ${s.inFlight} request đo chưa kết thúc sau 31 giây`);

    const row = {
      users: target,
      reqPerSec: s.latencies.length / seconds,
      p50: percentile(s.latencies, 50),
      p95: percentile(s.latencies, 95),
      p99: percentile(s.latencies, 99),
      errorRate: s.latencies.length ? (s.errors / s.latencies.length) * 100 : 100,
      byAction: Object.fromEntries(
        Object.entries(s.byAction).map(([name, v]) => [name, { count: v.length, p95: percentile(v, 95), p99: percentile(v, 99) }])
      ),
    };
    row.pass = row.p99 <= MAX_P99 && row.errorRate <= MAX_ERR;
    results.push(row);
    console.log(
      String(target).padEnd(12) +
        row.reqPerSec.toFixed(1).padEnd(11) +
        ms(row.p50).padEnd(9) +
        ms(row.p95).padEnd(9) +
        ms(row.p99).padEnd(9) +
        row.errorRate.toFixed(1).padEnd(8) +
        (row.pass ? "✓ đạt" : "✗ quá tải")
    );
    if (!row.pass) break;
  }
  running = false;

  const best = results.filter((r) => r.pass).at(-1);
  const failed = results.find((r) => !r.pass);
  console.log("");
  if (best) {
    const avgThink = (THINK_MIN + THINK_MAX) / 2;
    console.log(`✅ Chịu được ${best.users} người dùng đồng thời (mỗi người mở 1 trang khoảng ${avgThink}s một lần), p99 ${ms(best.p99)}`);
    for (const [name, a] of Object.entries(best.byAction)) {
      console.log(`   ${name.padEnd(22)} p95 ${ms(a.p95).padEnd(8)} p99 ${ms(a.p99)}`);
    }
  } else {
    console.log(`❌ Không đạt ngay từ ${results.at(0)?.users} người dùng`);
  }
  if (failed) console.log(`⚠ Quá tải từ ${failed.users} người: p99 ${ms(failed.p99)}, lỗi ${failed.errorRate.toFixed(1)}%`);
  else console.log(`   Chưa chạm ngưỡng — có thể thêm bậc lớn hơn vào STAGES`);

  const outDir = join(dirname(fileURLToPath(import.meta.url)), "results");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `users-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(outFile, JSON.stringify({ baseUrl: BASE_URL, thinkSeconds: [THINK_MIN, THINK_MAX], hold: HOLD, results }, null, 2));
  console.log(`\n💾 Kết quả chi tiết: ${outFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
