import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enrichNotifications } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;

  // ?summary=1: chuông thông báo hỏi định kỳ — chỉ số chưa đọc và id thông báo mới nhất,
  // client tự tải danh sách đầy đủ khi một trong hai thay đổi
  if (req.nextUrl.searchParams.get("summary") === "1") {
    const [latest, unreadCount] = await Promise.all([
      prisma.notification.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      }),
      prisma.notification.count({ where: { userId, status: "UNREAD" } }),
    ]);
    return NextResponse.json({ latestId: latest?.id ?? null, unreadCount });
  }

  const [rawNotifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.notification.count({
      where: { userId, status: "UNREAD" },
    }),
  ]);

  const notifications = await enrichNotifications(rawNotifications);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
  const body = await req.json().catch(() => ({}));

  if (body.markAll) {
    await prisma.notification.updateMany({
      where: { userId, status: "UNREAD" },
      data: { status: "READ" },
    });
    return NextResponse.json({ message: "Đã đánh dấu tất cả là đã đọc" });
  }

  if (body.id) {
    await prisma.notification.updateMany({
      where: { id: body.id, userId },
      data: { status: "READ" },
    });
    return NextResponse.json({ message: "Đã đánh dấu đã đọc" });
  }

  return NextResponse.json({ error: "Tham số không hợp lệ" }, { status: 400 });
}
