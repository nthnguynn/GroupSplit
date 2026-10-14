import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventEmitter } from "@/lib/events";

export async function PATCH(
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
    if (group.ownerId !== userId)
      return NextResponse.json({ error: "Chỉ Trưởng nhóm mới được chọn quản lý quỹ" }, { status: 403 });

    const { fundManagerId } = await req.json();

    // Verify target user is in the group (or allow null to reset)
    if (fundManagerId !== null) {
      const isMember = await prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: fundManagerId, groupId } },
      });
      if (!isMember) {
        return NextResponse.json({ error: "Người quản lý quỹ phải là thành viên trong nhóm" }, { status: 400 });
      }
    }

    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: { fundManagerId },
    });

    // Phát sự kiện cập nhật realtime qua SSE
    eventEmitter.emit(`group:${groupId}`, { type: "REFRESH" });

    return NextResponse.json(updatedGroup, { status: 200 });
  } catch (err: any) {
    console.error("Lỗi cập nhật người giữ quỹ:", err);
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
