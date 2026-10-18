import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/user-select";
import { createNotification } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: invitationId } = await params;
  const userId = session.user.id!;

  const invitation = await prisma.groupInvitation.findUnique({
    where: { id: invitationId },
    include: { group: true, inviter: { select: publicUserSelect } },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Lời mời không tồn tại" }, { status: 404 });
  }

  if (invitation.invitedUserId !== userId) {
    return NextResponse.json({ error: "Bạn không có quyền phản hồi lời mời này" }, { status: 403 });
  }

  if (invitation.status !== "PENDING") {
    return NextResponse.json({ error: "Lời mời này đã được xử lý" }, { status: 400 });
  }

  const { action } = await req.json(); // "ACCEPT" | "DECLINE"

  if (action !== "ACCEPT" && action !== "DECLINE") {
    return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
  }

  // Kiểm tra PENDING ở trên chưa đủ khi 2 request đến cùng lúc: chỉ request chuyển được trạng thái mới xử lý tiếp
  const { count } = await prisma.groupInvitation.updateMany({
    where: { id: invitationId, status: "PENDING" },
    data: { status: action === "ACCEPT" ? "ACCEPTED" : "DECLINED" },
  });
  if (count === 0) {
    return NextResponse.json({ error: "Lời mời này đã được xử lý" }, { status: 400 });
  }

  if (action === "ACCEPT") {
    // Add to group member if not already
    const existingMember = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId: invitation.groupId } },
    });

    if (!existingMember) {
      await prisma.groupMember.create({
        data: {
          userId,
          groupId: invitation.groupId,
          role: "MEMBER",
        },
      });
    } else if (existingMember.isLeft) {
      await prisma.groupMember.update({
        where: { id: existingMember.id },
        data: {
          isLeft: false,
          leftAt: null,
          joinedAt: new Date(),
        },
      });
    }

    // Notify inviter (Owner)
    await createNotification({
      userId: invitation.inviterId,
      title: `Lời mời nhóm được chấp nhận`,
      content: `${session.user.name || "Thành viên"} đã đồng ý tham gia nhóm "${invitation.group.name}".`,
      type: "INVITE_ACCEPTED",
      link: `/groups/${invitation.groupId}`,
      entityId: invitation.groupId,
    });

    return NextResponse.json({ message: `Đã tham gia nhóm ${invitation.group.name}` });
  } else {
    // Notify inviter
    await createNotification({
      userId: invitation.inviterId,
      title: `Lời mời nhóm bị từ chối`,
      content: `${session.user.name || "Người dùng"} đã từ chối lời mời tham gia nhóm "${invitation.group.name}".`,
      type: "INVITE_DECLINED",
      link: `/groups/${invitation.groupId}`,
      entityId: invitation.groupId,
    });

    return NextResponse.json({ message: "Đã từ chối lời mời" });
  }
}
