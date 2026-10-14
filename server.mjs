/**
 * Chạy Next.js production trên nhiều tiến trình (cluster) để dùng hết các nhân CPU.
 * `next start` chỉ chạy 1 tiến trình = 1 nhân CPU; đây là custom server theo
 * node_modules/next/dist/docs/01-app/02-guides/custom-server.md, mỗi worker một instance.
 *
 * Biến môi trường:
 *   PORT                  cổng lắng nghe (mặc định 3000)
 *   WEB_CONCURRENCY       số worker (mặc định = số nhân CPU, tối đa 16)
 *   DB_CONNECTION_BUDGET  tổng số kết nối DB cho mọi worker (mặc định 80, < max_connections 100 của Postgres)
 *   DB_POOL_MAX           ghi đè số kết nối DB của mỗi worker
 */
import cluster from "node:cluster";
import http from "node:http";
import os from "node:os";
import next from "next";

const port = Number(process.env.PORT) || 3000;
// Mặc định tối đa 16 worker để mỗi worker vẫn còn đủ kết nối DB trong DB_CONNECTION_BUDGET
const workers = Math.max(1, Number(process.env.WEB_CONCURRENCY) || Math.min(os.availableParallelism(), 16));

async function startWorker() {
  const app = next({ dev: false, port });
  const handle = app.getRequestHandler();
  await app.prepare();
  http.createServer((req, res) => handle(req, res)).listen(port);
}

if (cluster.isPrimary && workers > 1) {
  const budget = Number(process.env.DB_CONNECTION_BUDGET) || 80;
  // Mỗi worker còn giữ thêm 1 kết nối LISTEN cho realtime (src/lib/events.ts)
  process.env.DB_POOL_MAX ||= String(Math.max(2, Math.floor(budget / workers) - 1));
  console.log(`> GroupSplit: ${workers} worker, cổng ${port}, ${process.env.DB_POOL_MAX} kết nối DB/worker`);

  // Tiến trình chính chia đều kết nối cho worker (mặc định trên Linux; Windows phải bật tay)
  cluster.schedulingPolicy = cluster.SCHED_RR;

  let shuttingDown = false;
  for (let i = 0; i < workers; i++) cluster.fork();

  cluster.on("exit", (worker, code, signal) => {
    if (shuttingDown) return;
    console.error(`> Worker ${worker.process.pid} dừng (${signal ?? code}) — khởi động lại`);
    cluster.fork();
  });

  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.on(signal, () => {
      shuttingDown = true;
      for (const worker of Object.values(cluster.workers ?? {})) worker?.process.kill(signal);
      setTimeout(() => process.exit(0), 10_000).unref();
      cluster.on("exit", () => {
        if (Object.keys(cluster.workers ?? {}).length === 0) process.exit(0);
      });
    });
  }
} else {
  await startWorker();
  if (!cluster.isWorker) console.log(`> GroupSplit: 1 tiến trình, cổng ${port}`);
}
