// Tạo Intl formatter một lần rồi dùng lại — khởi tạo Intl.* rất tốn CPU,
// trong khi mỗi trang gọi format hàng trăm lần.
const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatVND(amount: number): string {
  return vndFormatter.format(amount || 0);
}

export function formatDate(date?: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return dateTimeFormatter.format(d);
}

export function formatDateTime(date?: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return dateTimeFormatter.format(d);
}

export function getInitials(name?: string | null): string {
  if (!name || typeof name !== "string") return "GS";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GS";
  return parts
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function generateInviteUrl(inviteCode: string): string {
  const baseUrl =
    process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/groups/join/${inviteCode}`;
}
