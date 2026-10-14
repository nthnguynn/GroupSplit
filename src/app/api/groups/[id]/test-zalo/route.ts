import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendDirectZaloTest } from "@/lib/zalo";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: groupId } = await params;
    const userId = session.user.id!;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: "Nhóm không tồn tại" }, { status: 404 });
    if (group.ownerId !== userId) {
      return NextResponse.json({ error: "Chỉ trưởng nhóm mới thực hiện được" }, { status: 403 });
    }

    const { zaloChatId } = await req.json();
    if (!zaloChatId || !zaloChatId.trim()) {
      return NextResponse.json({ error: "Vui lòng nhập Zalo Chat ID" }, { status: 400 });
    }

    await sendDirectZaloTest(zaloChatId, group.name);

    return NextResponse.json({ success: true, message: "Đã gửi tin nhắn thử nghiệm tới Zalo nhóm thành công!" });
  } catch (err: any) {
    console.error("Test zalo error:", err);
    return NextResponse.json(
      { error: err.message || "Không thể gửi tin nhắn thử nghiệm Zalo." },
      { status: 400 }
    );
  }
}
