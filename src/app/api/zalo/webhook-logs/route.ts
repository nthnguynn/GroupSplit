import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { zaloWebhookLogStore } from "@/lib/zalo-log-store";

async function verifyAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user as any;
  if (user.username !== "qy286" && user.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Quyền truy cập bị từ chối" }, { status: 403 });
  }

  const logs = zaloWebhookLogStore.getAll();
  return NextResponse.json({
    success: true,
    totalLogs: logs.length,
    logs,
  });
}

export async function DELETE() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Quyền truy cập bị từ chối" }, { status: 403 });
  }

  zaloWebhookLogStore.clear();
  return NextResponse.json({
    success: true,
    message: "Cleared all webhook logs",
  });
}
