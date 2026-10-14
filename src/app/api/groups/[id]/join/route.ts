import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendUserZaloNotification } from "@/lib/zalo";

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

    const existingMember = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (existingMember && !existingMember.isLeft) return NextResponse.json({ error: "Bạn đã là thành viên của nhóm này" }, { status: 409 });

    const member = await prisma.groupMember.create({
      data: { userId, groupId, role: "MEMBER" },
      include: { user: { select: { displayName: true } } },
    });

    // Gửi thông báo Zalo Bot cá nhân cho Trưởng nhóm
    const msg = `👋 [Thành viên mới gia nhập nhóm ${group.name}]
${member.user.displayName} vừa gia nhập nhóm của bạn! 🎉`;

    sendUserZaloNotification(group.ownerId, msg);

    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    console.error("Error in join API:", error);
    return NextResponse.json(
      { error: error?.message || "Đã xảy ra lỗi trên hệ thống" },
      { status: 500 }
    );
  }
}
