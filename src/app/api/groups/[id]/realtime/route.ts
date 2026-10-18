import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventEmitter } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;

  // Chỉ thành viên đang hoạt động của nhóm mới được nghe sự kiện của nhóm
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
    select: { isLeft: true },
  });
  if (!membership || membership.isLeft) {
    return NextResponse.json({ error: "Bạn không thuộc nhóm này" }, { status: 403 });
  }

  const responseHeaders = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
  });

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connect signal
      controller.enqueue("data: {\"type\":\"CONNECTED\"}\n\n");

      const listener = (data: any) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch (err) {
          console.error("Error enqueuing event:", err);
        }
      };

      // Đăng ký sự kiện lắng nghe của nhóm này
      eventEmitter.on(`group:${groupId}`, listener);

      // Reverse proxy (Nginx Proxy Manager mặc định proxy_read_timeout 60s) cắt kết nối im lặng quá lâu,
      // trình duyệt lại phải kết nối lại (thêm 1 lượt xác thực + truy vấn). Dòng chú thích SSE giữ kết nối sống.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(": ping\n\n");
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Giải phóng tài nguyên khi ngắt kết nối
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        eventEmitter.off(`group:${groupId}`, listener);
      });
    },
  });

  return new Response(stream, { headers: responseHeaders });
}
