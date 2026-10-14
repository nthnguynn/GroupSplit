import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/user-select";
import { calculateDebts } from "@/lib/debt-calculator";
import { createNotification } from "@/lib/notifications";
import { eventEmitter } from "@/lib/events";
import { sendUserZaloNotification } from "@/lib/zalo";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId, userId: targetUserId } = await params;
  const currentUserId = session.user.id!;

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      owner: { select: publicUserSelect },
      members: { include: { user: { select: publicUserSelect } } },
      expenses: {
        where: { status: "APPROVED" },
        include: { splits: true },
      },
      settlements: { where: { isConfirmed: true } },
      fundAllocations: true,
    },
  });

  if (!group) return NextResponse.json({ error: "Nhóm không tồn tại" }, { status: 404 });

  // 1. Phân quyền: Chỉ Trưởng nhóm mới có quyền xoá thành viên
  if (group.ownerId !== currentUserId) {
    return NextResponse.json(
      { error: "Chỉ Trưởng nhóm mới có quyền xoá thành viên khỏi nhóm" },
      { status: 403 }
    );
  }

  // 2. Không thể tự xoá Trưởng nhóm
  if (targetUserId === group.ownerId) {
    return NextResponse.json(
      { error: "Không thể xoá Trưởng nhóm khỏi nhóm. Vui lòng chuyển quyền Trưởng nhóm trước nếu cần." },
      { status: 400 }
    );
  }

  // 3. Kiểm tra thành viên có trong nhóm không
  const membership = group.members.find((m) => m.userId === targetUserId);
  if (!membership || membership.isLeft) {
    return NextResponse.json(
      { error: "Thành viên này không tồn tại trong nhóm hoặc đã rời nhóm từ trước" },
      { status: 404 }
    );
  }

  // 4. Kiểm tra công nợ của thành viên cần xoá
  const { balances } = calculateDebts(
    group.expenses,
    group.members,
    group.settlements,
    group.ownerId,
    group.fundAllocations
  );

  const memberBalance = balances.find((b) => b.userId === targetUserId)?.balance ?? 0;

  if (Math.abs(memberBalance) > 0.01) {
    return NextResponse.json(
      {
        error: `Không thể xoá thành viên này do vẫn còn công nợ chưa thanh toán hết (Dư nợ hiện tại: ${memberBalance > 0 ? "+" : ""}${memberBalance.toLocaleString("vi-VN")}đ). Cần thanh toán công nợ về 0đ trước khi xoá.`,
      },
      { status: 400 }
    );
  }

  // 5. Đánh dấu thành viên đã rời nhóm (isLeft = true)
  // Các hoá đơn cũ (Expense và ExpenseSplit) liên kết trực tiếp tới User nên vẫn hiển thị tên bình thường
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({
      where: { userId_groupId: { userId: targetUserId, groupId } },
      data: {
        isLeft: true,
        leftAt: new Date(),
      },
    });

    // Nếu thành viên này đang là Quản lý quỹ thì gỡ vai trò
    if (group.fundManagerId === targetUserId) {
      await tx.group.update({
        where: { id: groupId },
        data: { fundManagerId: null },
      });
    }
  });

  // 6. Gửi thông báo In-app cho thành viên bị xoá
  await createNotification({
    userId: targetUserId,
    title: `Bạn đã bị xoá khỏi nhóm`,
    content: `Trưởng nhóm đã xoá bạn khỏi nhóm "${group.name}".`,
    type: "MEMBER_LEFT",
    link: `/groups`,
    entityId: groupId,
  });

  // 7. Gửi thông báo Zalo nếu có
  sendUserZaloNotification(
    targetUserId,
    `🚫 [Thông báo nhóm]\nTrưởng nhóm đã xoá bạn khỏi nhóm "${group.name}".`
  );

  // 8. Phát sóng sự kiện SSE cập nhật realtime cho nhóm
  eventEmitter.emit(`group:${groupId}`, { type: "REFRESH" });

  return NextResponse.json({
    message: `Đã xoá thành viên ${membership.user.displayName} khỏi nhóm thành công`,
  });
}
