import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventEmitter } from "@/lib/events";
import { createNotification } from "@/lib/notifications";
import { formatVND } from "@/lib/utils/format";
import { sendMultipleUsersZaloNotification } from "@/lib/zalo";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const userId = session.user.id!;

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership)
    return NextResponse.json({ error: "Không thuộc nhóm này" }, { status: 403 });

  const { fromUserId, toUserId, amount, note } = await req.json();

  // Only the debtor can mark as paid
  if (fromUserId !== userId)
    return NextResponse.json({ error: "Chỉ người nợ mới đánh dấu được" }, { status: 403 });

  const settlement = await prisma.settlement.create({
    data: {
      groupId,
      fromUserId,
      toUserId,
      amount,
      note,
      isConfirmed: false,
    },
    include: {
      fromUser: { select: { displayName: true } },
      toUser: { select: { displayName: true } },
    },
  });

  // Nếu không phải trạng thái chờ quét QR nháp thì mới gửi thông báo
  if (!note?.startsWith("[QR_PENDING]")) {
    // Send Notification to recipient (toUserId)
    await createNotification({
      userId: toUserId,
      title: `Yêu cầu xác nhận nhận tiền`,
      content: `${session.user.name || "Thành viên"} đã đánh dấu trả cho bạn số tiền ${formatVND(amount)}. Vui lòng kiểm tra và xác nhận.`,
      type: "SETTLEMENT_PENDING",
      link: `/groups/${groupId}`,
      entityId: settlement.id,
    });

    // Gửi thông báo Zalo Bot cá nhân
    const cleanNote = note || "Chuyển khoản / Tiền mặt";
    const msg = `💸 [Thông báo chuyển tiền]
${settlement.fromUser.displayName} ➔ ${settlement.toUser.displayName}
💰 Số tiền: ${formatVND(amount)}
📝 Chi tiết: ${cleanNote}
⏳ Trạng thái: Đã chuyển (Chờ xác nhận)`;

    sendMultipleUsersZaloNotification([fromUserId, toUserId], msg);
  }

  // Phát sóng tin nhắn cập nhật cho tất cả client
  eventEmitter.emit(`group:${groupId}`, { type: "REFRESH" });

  return NextResponse.json(settlement, { status: 201 });
}
