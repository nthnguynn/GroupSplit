import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const inviterId = session.user.id!;

  // Only owner can invite members by username
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Nhóm không tồn tại" }, { status: 404 });
  if (group.ownerId !== inviterId)
    return NextResponse.json({ error: "Chỉ Trưởng nhóm mới có thể gửi lời mời" }, { status: 403 });

  const { username } = await req.json();

  const targetUser = await prisma.user.findUnique({ where: { username } });
  if (!targetUser)
    return NextResponse.json({ error: "Không tìm thấy người dùng với username này" }, { status: 404 });

  if (targetUser.id === inviterId) {
    return NextResponse.json({ error: "Bạn đã là Trưởng nhóm" }, { status: 400 });
  }

  // Check if already an active member
  const existingMember = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: targetUser.id, groupId } },
  });
  if (existingMember && !existingMember.isLeft)
    return NextResponse.json({ error: "Người dùng này đã là thành viên của nhóm" }, { status: 409 });

  // Check if already pending invitation
  const existingInvite = await prisma.groupInvitation.findFirst({
    where: {
      groupId,
      invitedUserId: targetUser.id,
      status: "PENDING",
    },
  });
  if (existingInvite)
    return NextResponse.json({ error: "Đã gửi lời mời tới người dùng này, đang chờ phản hồi" }, { status: 409 });

  // Create Invitation
  const invitation = await prisma.groupInvitation.create({
    data: {
      groupId,
      inviterId,
      invitedUserId: targetUser.id,
      status: "PENDING",
    },
  });

  // Create Notification for the invited user
  await createNotification({
    userId: targetUser.id,
    title: `Lời mời tham gia nhóm "${group.name}"`,
    content: `${session.user.name || "Trưởng nhóm"} đã mời bạn tham gia nhóm "${group.name}".`,
    type: "GROUP_INVITE",
    entityId: invitation.id,
    link: `/notifications`,
  });

  return NextResponse.json({ message: `Đã gửi lời mời tới @${targetUser.username}`, invitation }, { status: 201 });
}
