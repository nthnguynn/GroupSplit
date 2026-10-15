/**
 * Load test GroupSplit bằng autocannon: tăng dần số kết nối đồng thời trên từng
 * endpoint để tìm ngưỡng chịu tải (req/s tối đa mà p99 và tỷ lệ lỗi vẫn ổn).
 *
 * Chuẩn bị:
 *   1. bun run bench:seed                        (tạo user bench_owner + nhóm [BENCH])
 *   2. bun run build && bun run bench:server          (cluster giống Portainer — KHÔNG dùng next dev)
 *      hoặc bun run bench:server:single               (1 tiến trình để lấy baseline 1 CPU)
 * Chạy:
 *   bun run bench
 *
 * Tùy chỉnh qua biến môi trường:
 *   BASE_URL   mặc định http://localhost:3005
 *   STAGES     số kết nối đồng thời mỗi bậc, mặc định "10,50,100,200"
 *   DURATION   số giây mỗi bậc, mặc định 10
 *   ONLY       chỉ chạy một số target, vd "api-groups,group-page"
 *   MAX_P99    ngưỡng p99 (ms) coi là chấp nhận được, mặc định 1000
 *   MAX_ERR    tỷ lệ lỗi tối đa (%) chấp nhận được, mặc định 1
 */
import autocannon from "autocannon";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3005").replace(/\/$/, "");
const STAGES = (process.env.STAGES ?? "10,50,100,200")
  .split(",")
  .map(Number)
  .filter((n) => n > 0);
const DURATION = Number(process.env.DURATION ?? 10);
const ONLY = process.env.ONLY?.split(",").map((s) => s.trim()).filter(Boolean);
const MAX_P99 = Number(process.env.MAX_P99 ?? 1000);
const MAX_ERR = Number(process.env.MAX_ERR ?? 1);
const USERNAME = process.env.BENCH_USER ?? "bench_owner";
const PASSWORD = process.env.BENCH_PASSWORD ?? "bench123456";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function storeCookies(jar, res) {
  for (const c of res.headers.getSetCookie()) {
    const pair = c.split(";")[0];
    const idx = pair.indexOf("=");
    jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1));
  }
}

const cookieHeader = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function login() {
  const jar = new Map();
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  if (!csrfRes.ok) throw new Error(`GET /api/auth/csrf trả về ${csrfRes.status}`);
  storeCookies(jar, csrfRes);
  const { csrfToken } = await csrfRes.json();

  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(jar),
    },
    body: new URLSearchParams({
      csrfToken,
      username: USERNAME,
      password: PASSWORD,
      callbackUrl: `${BASE_URL}/dashboard`,
    }),
    redirect: "manual",
  });
  storeCookies(jar, res);

  const cookie = cookieHeader(jar);
  const session = await fetch(`${BASE_URL}/api/auth/session`, { headers: { cookie } }).then((r) => r.json());
  if (!session?.user) {
    throw new Error(`Đăng nhập ${USERNAME} thất bại — đã chạy "bun run bench:seed" chưa?`);
  }
  return cookie;
}

async function findBenchGroup(cookie) {
  const groups = await fetch(`${BASE_URL}/api/groups`, { headers: { cookie } }).then((r) => r.json());
  const group = Array.isArray(groups) && groups.find((g) => g.name.startsWith("[BENCH]"));
  if (!group) throw new Error(`Không tìm thấy nhóm [BENCH] — chạy "bun run bench:seed" trước.`);
  return group;
}

function summarize(result) {
  const ok = result["2xx"];
  const failed = result.non2xx + result.errors;
  return {
    // Không request nào kịp xong trong DURATION giây — server bị nghẽn, không phải trả lỗi
    stalled: ok + failed === 0,
    reqPerSec: Math.round(result.requests.average),
    p50: result.latency.p50,
    p90: result.latency.p90,
    p99: result.latency.p99,
    max: result.latency.max,
    total: ok + failed,
    non2xx: result.non2xx,
    errors: result.errors,
    timeouts: result.timeouts,
    errorRate: ok + failed === 0 ? 100 : (failed / (ok + failed)) * 100,
  };
}

const COLS = [
  ["Endpoint", 26],
  ["Kết nối", 8],
  ["Req/s", 8],
  ["p50", 8],
  ["p90", 8],
  ["p99", 8],
  ["Max", 8],
  ["Lỗi %", 7],
];
const fmtRow = (cells) => cells.map((c, i) => String(c).padEnd(COLS[i][1])).join(" ");
const ms = (v) => `${Math.round(v)}ms`;

function printRow(target, conns, s) {
  if (s.stalled) {
    console.log(fmtRow([target.name, conns, 0, "-", "-", "-", "-", "-"]) + `  ⚠ không request nào xong trong ${DURATION}s`);
    return;
  }
  const flag = s.p99 > MAX_P99 || s.errorRate > MAX_ERR ? "  ⚠" : "";
  console.log(
    fmtRow([target.name, conns, s.reqPerSec, ms(s.p50), ms(s.p90), ms(s.p99), ms(s.max), s.errorRate.toFixed(1)]) + flag
  );
}

async function main() {
  console.log(`🎯 ${BASE_URL} — bậc kết nối [${STAGES.join(", ")}], ${DURATION}s/bậc`);
  console.log(`   Ngưỡng đạt: p99 ≤ ${MAX_P99}ms và lỗi ≤ ${MAX_ERR}%\n`);

  const cookie = await login();
  const group = await findBenchGroup(cookie);
  console.log(`🔑 Đã đăng nhập ${USERNAME}, nhóm bench: ${group.id} (${group._count?.expenses ?? "?"} khoản chi)\n`);

  const targets = [
    { id: "landing", name: "Trang chủ /", path: "/", auth: false },
    { id: "login", name: "Trang /login", path: "/login", auth: false },
    { id: "api-groups", name: "GET /api/groups", path: "/api/groups", auth: true },
    { id: "api-notifications", name: "GET /api/notifications", path: "/api/notifications", auth: true },
    { id: "dashboard", name: "Trang /dashboard", path: "/dashboard", auth: true },
    { id: "group-page", name: "Trang chi tiết nhóm", path: `/groups/${group.id}`, auth: true },
  ].filter((t) => !ONLY || ONLY.includes(t.id));

  console.log(fmtRow(COLS.map(([h]) => h)));
  console.log("-".repeat(COLS.reduce((n, [, w]) => n + w + 1, 0)));

  const results = [];
  for (const target of targets) {
    const url = BASE_URL + target.path;
    const headers = target.auth ? { cookie } : {};

    // Warm-up + kiểm tra endpoint trả 200 trước khi dồn tải
    const warm = await fetch(url, { headers, redirect: "manual" });
    if (warm.status !== 200) {
      console.log(`${target.name}: bỏ qua — warm-up trả về ${warm.status}`);
      continue;
    }

    for (const connections of STAGES) {
      const raw = await autocannon({ url, connections, duration: DURATION, headers, timeout: 30 });
      const s = summarize(raw);
      printRow(target, connections, s);
      results.push({ target: target.id, name: target.name, path: target.path, connections, ...s });

      // Đã sập hẳn thì không cần tăng tải thêm
      if (s.stalled || s.errorRate > 50 || s.p99 > MAX_P99 * 10) break;
      await sleep(2000);
    }
  }

  console.log(`\n📊 NGƯỠNG CHỊU TẢI (p99 ≤ ${MAX_P99}ms, lỗi ≤ ${MAX_ERR}%)`);
  for (const target of targets) {
    const rows = results.filter((r) => r.target === target.id);
    if (!rows.length) continue;
    const passing = rows.filter((r) => r.p99 <= MAX_P99 && r.errorRate <= MAX_ERR);
    if (!passing.length) {
      console.log(`  ✗ ${target.name}: không đạt ngay từ ${rows[0].connections} kết nối (p99 ${ms(rows[0].p99)})`);
      continue;
    }
    const best = passing.reduce((a, b) => (b.reqPerSec > a.reqPerSec ? b : a));
    const maxConns = Math.max(...passing.map((r) => r.connections));
    const note = maxConns === Math.max(...STAGES) ? " (chưa chạm ngưỡng, có thể tăng STAGES)" : "";
    console.log(`  ✓ ${target.name}: ~${best.reqPerSec} req/s, ổn định tới ${maxConns} kết nối đồng thời${note}`);
  }

  const outDir = join(dirname(fileURLToPath(import.meta.url)), "results");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(
    outFile,
    JSON.stringify({ baseUrl: BASE_URL, stages: STAGES, duration: DURATION, maxP99: MAX_P99, maxErr: MAX_ERR, results }, null, 2)
  );
  console.log(`\n💾 Kết quả chi tiết: ${outFile}`);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
