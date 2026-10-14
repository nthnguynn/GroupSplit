export interface WebhookLogEntry {
  id: string;
  timestamp: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  status: number;
  response: any;
}

declare global {
  var zaloWebhookLogs: WebhookLogEntry[] | undefined;
}

if (!globalThis.zaloWebhookLogs) {
  globalThis.zaloWebhookLogs = [];
}

export const zaloWebhookLogStore = {
  add(log: Omit<WebhookLogEntry, "id">) {
    const entry: WebhookLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      ...log,
    };
    globalThis.zaloWebhookLogs = [entry, ...(globalThis.zaloWebhookLogs || []).slice(0, 49)];
    return entry;
  },
  getAll() {
    return globalThis.zaloWebhookLogs || [];
  },
  clear() {
    globalThis.zaloWebhookLogs = [];
  },
};
