/**
 * Đo sức chịu tải theo số nhân CPU: chạy image Docker production với giới hạn --cpus=N
 * (WEB_CONCURRENCY=N worker), bắn tải từng loại trang và báo req/s, req/s mỗi nhân.
 *
 * Chuẩn bị:
 *   1. bun run bench:seed                     (dữ liệu test)
 *   2. docker build -t groupsplit:capacity .  (image production)
 * Chạy:
 *   bun run bench:cpu
 *
 * Tùy chỉnh:
 *   CPUS          các mức CPU cần đo, mặc định "1,2,4,8"
 *   IMAGE         image cần đo, mặc định groupsplit:capacity
 *   DURATION      số giây đo mỗi trang, mặc định 10
 *   CONNECTIONS   số kết nối đồng thời khi đo, mặc định 32 (đủ để dùng hết CPU)
 *   Container dùng DATABASE_URL trong .env, đổi localhost → host.docker.internal.
 */
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import autocannon from "autocannon";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
process.loadEnvFile(join(root, ".env"));

const CPUS = (process.env.CPUS ?? "1,2,4,8").split(",").map(Number).filter((n) => n > 0);
const IMAGE = process.env.IMAGE ?? "groupsplit:capacity";
const DURATION = Number(process.env.DURATION ?? 10);
const CONNECTIONS = Number(process.env.CONNECTIONS ?? 32);
const PORT = 3011;
const NAME = "groupsplit-capacity";
const B = `http://localhost:${PORT}`;
const DB_URL = process.env.DATABASE_URL.replace(/@(localhost|127\.0\.0\.1)([:/])/, "@host.docker.internal$2");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();

function startContainer(cpus) {
  try { sh(`docker rm -f ${NAME}`); } catch {}
  sh(
    `docker run -d --name ${NAME} --cpus=${cpus} -p ${PORT}:3000 ` +
      `-e DATABASE_URL="${DB_URL}" -e AUTH_SECRET="${randomBytes(32).toString("base64")}" ` +
      `-e AUTH_TRUST_HOST=true -e WEB_CONCURRENCY=${cpus} ${IMAGE}`
  );
}

async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${B}/login`)).status === 200) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("Container không khởi động được — xem: docker logs " + NAME);
}

async function login() {
  const jar = new Map();
  const st = (r) => { for (const c of r.headers.getSetCookie()) { const p = c.split(";")[0]; const i = p.indexOf("="); jar.set(p.slice(0, i), p.slice(i + 1)); } };
  const ck = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  let r = await fetch(`${B}/api/auth/csrf`); st(r);
  const { csrfToken } = await r.json();
  r = await fetch(`${B}/api/auth/callback/credentials`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie: ck() }, body: new URLSearchParams({ csrfToken, username: "bench_owner", password: "bench123456" }), redirect: "manual" }); st(r);
  return ck();
}

async function main() {
  console.log(`🎯 ${IMAGE} — mức CPU [${CPUS.join(", ")}], ${CONNECTIONS} kết nối, ${DURATION}s/trang\n`);
  const results = [];

  for (const cpus of CPUS) {
    process.stdout.write(`▶ ${cpus} CPU: khởi động container... `);
    startContainer(cpus);
    await waitReady();
    await sleep(3000);
    const cookie = await login();
    const groups = await (await fetch(`${B}/api/groups`, { headers: { cookie } })).json();
    const group = groups.find((g) => g.name.startsWith("[BENCH]"));
    if (!group) throw new Error('Không có nhóm [BENCH] — chạy "bun run bench:seed" trước');
    const now = Date.now();
    const iso = (t) => new Date(t).toISOString();
    const ymd = (t) => iso(t).slice(0, 10);
    const targets = [
      ["API nhẹ (/api/notifications)", "/api/notifications"],
      ["Trang chủ /", "/"],
      ["Trang nhóm", `/groups/${group.id}?from=${iso(now - 86400e3)}&to=${iso(now)}`],
      ["Dashboard", `/dashboard?from=${ymd(now - 2 * 86400e3)}&to=${ymd(now)}`],
    ];
    console.log("sẵn sàng");

    for (const [name, path] of targets) {
      const url = B + path;
      await autocannon({ url, connections: 8, duration: 3, headers: { cookie } }); // warm-up
      const r = await autocannon({ url, connections: CONNECTIONS, duration: DURATION, headers: { cookie }, timeout: 30 });
      const row = {
        cpus,
        name,
        reqPerSec: Math.round(r.requests.average),
        perCore: Math.round(r.requests.average / cpus),
        p50: r.latency.p50,
        p99: r.latency.p99,
        errors: r.non2xx + r.errors,
      };
      results.push(row);
      console.log(`   ${name.padEnd(30)} ${String(row.reqPerSec).padStart(5)} req/s  (${String(row.perCore).padStart(4)}/nhân)  p50 ${row.p50}ms  p99 ${row.p99}ms  lỗi ${row.errors}`);
    }
  }
  try { sh(`docker rm -f ${NAME}`); } catch {}

  console.log("\n📊 req/s theo số CPU (trong ngoặc: req/s mỗi nhân)");
  const names = [...new Set(results.map((r) => r.name))];
  console.log("".padEnd(32) + CPUS.map((c) => `${c} CPU`.padStart(16)).join(""));
  for (const n of names) {
    const cells = CPUS.map((c) => {
      const r = results.find((x) => x.name === n && x.cpus === c);
      return `${r.reqPerSec} (${r.perCore})`.padStart(16);
    });
    console.log(n.padEnd(32) + cells.join(""));
  }

  const outDir = join(root, "scripts", "bench", "results");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `cpu-capacity-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(outFile, JSON.stringify({ image: IMAGE, connections: CONNECTIONS, duration: DURATION, results }, null, 2));
  console.log(`\n💾 ${outFile}`);
}

main().catch((err) => {
  try { sh(`docker rm -f ${NAME}`); } catch {}
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
