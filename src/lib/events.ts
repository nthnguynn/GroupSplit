import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import pg from "pg";
import { prisma } from "@/lib/prisma";

/**
 * Bus sự kiện realtime (SSE) dùng được khi chạy nhiều tiến trình/instance.
 * Giữ API của EventEmitter (emit/on/off) nên các route không phải đổi:
 *  - emit("group:<id>") phát ngay cho listener trong tiến trình này, đồng thời
 *    gửi Postgres NOTIFY để các tiến trình khác phát lại cho SSE client của chúng.
 *  - Tiến trình chỉ mở kết nối LISTEN khi có SSE client đăng ký.
 */
const CHANNEL = "groupsplit_events";
const PROCESS_ID = randomUUID();

const isGroupEvent = (event: string | symbol): event is string =>
  typeof event === "string" && event.startsWith("group:");

class GroupEventBus extends EventEmitter {
  private listenClient: pg.Client | null = null;
  private connecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    // Mỗi SSE client là một listener — không giới hạn 10 listener mặc định
    this.setMaxListeners(0);
    this.on("newListener", (event) => {
      if (isGroupEvent(event)) this.ensureListening();
    });
  }

  emit(event: string | symbol, ...args: unknown[]): boolean {
    const handled = super.emit(event, ...args);
    if (isGroupEvent(event)) {
      const payload = JSON.stringify({ event, data: args[0], origin: PROCESS_ID });
      prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, ${payload})`.catch((err) => {
        console.error("[events] NOTIFY lỗi:", err);
      });
    }
    return handled;
  }

  private hasGroupListeners() {
    return this.eventNames().some(isGroupEvent);
  }

  private ensureListening() {
    if (this.listenClient || this.connecting) return;
    this.connecting = true;

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        const { event, data, origin } = JSON.parse(msg.payload);
        // Sự kiện của chính tiến trình này đã được phát cục bộ trong emit()
        if (origin !== PROCESS_ID && isGroupEvent(event)) super.emit(event, data);
      } catch (err) {
        console.error("[events] Payload NOTIFY không hợp lệ:", err);
      }
    });
    client.on("error", (err) => {
      console.error("[events] Mất kết nối LISTEN:", err);
      this.dropListener(client);
    });
    client.on("end", () => this.dropListener(client));

    client
      .connect()
      .then(() => client.query(`LISTEN ${CHANNEL}`))
      .then(() => {
        this.listenClient = client;
      })
      .catch((err) => {
        console.error("[events] Không LISTEN được:", err);
        this.dropListener(client);
      })
      .finally(() => {
        this.connecting = false;
      });
  }

  private dropListener(client: pg.Client) {
    if (this.listenClient === client) this.listenClient = null;
    client.end().catch(() => {});
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.hasGroupListeners()) this.ensureListening();
    }, 2000);
    this.reconnectTimer.unref();
  }
}

const globalForEvents = globalThis as unknown as {
  eventEmitter: GroupEventBus | undefined;
};

export const eventEmitter = globalForEvents.eventEmitter ?? new GroupEventBus();

// Dùng chung một bus cho cả tiến trình (kể cả production) — Next nạp module riêng cho từng bundle
globalForEvents.eventEmitter = eventEmitter;
