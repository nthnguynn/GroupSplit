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

  const { id: requestId } = await params;
  const userId = session.user.id!;

  const joinRequest = await prisma.groupJoinRequest.findUnique({
    where: { id: requestId },
    include: { group: true, user: { select: publicUserSelect } },
  });

  if (!joinRequest) {
    return NextResponse.json({ error: "Yêu cầu không tồn tại" }, { status: 404 });
  }

  // Only Group Owner can approve/reject join requests
  if (joinRequest.group.ownerId !== userId) {
    return NextResponse.json({ error: "Chỉ Trưởng nhóm mới có quyền duyệt yêu cầu tham gia" }, { status: 403 });
  }

  if (joinRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Yêu cầu này đã được xử lý" }, { status: 400 });
  }

  const { action } = await req.json(); // "APPROVE" | "REJECT"

  if (action === "APPROVE") {
    await prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED" },
    });

    const existingMember = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: joinRequest.userId, groupId: joinRequest.groupId } },
    });

    if (!existingMember) {
      await prisma.groupMember.create({
        data: {
          userId: joinRequest.userId,
          groupId: joinRequest.groupId,
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

    // Notify User
    await createNotification({
      userId: joinRequest.userId,
      title: `Yêu cầu tham gia nhóm đã được duyệt`,
      content: `Trưởng nhóm đã đồng ý cho bạn gia nhập nhóm "${joinRequest.group.name}".`,
      type: "JOIN_APPROVED",
      link: `/groups/${joinRequest.groupId}`,
      entityId: joinRequest.groupId,
    });

    return NextResponse.json({ message: `Đã duyệt ${joinRequest.user.displayName} vào nhóm` });
  } else if (action === "REJECT") {
    await prisma.groupJoinRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });

    // Notify User
    await createNotification({
      userId: joinRequest.userId,
      title: `Yêu cầu tham gia nhóm bị từ chối`,
      content: `Trưởng nhóm đã từ chối yêu cầu gia nhập nhóm "${joinRequest.group.name}" của bạn.`,
      type: "JOIN_REJECTED",
      link: `/groups`,
      entityId: joinRequest.groupId,
    });

    return NextResponse.json({ message: "Đã từ chối yêu cầu tham gia" });
  }

  return NextResponse.json({ error: "Hành động không hợp lệ" }, { status: 400 });
}
