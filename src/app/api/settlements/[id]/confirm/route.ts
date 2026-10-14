import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventEmitter } from "@/lib/events";
import { createNotification } from "@/lib/notifications";
import { formatVND } from "@/lib/utils/format";
import { sendMultipleUsersZaloNotification } from "@/lib/zalo";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id!;

  const settlement = await prisma.settlement.findUnique({ where: { id } });
  if (!settlement) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });

  // Only the creditor (toUser) can confirm
  if (settlement.toUserId !== userId)
    return NextResponse.json({ error: "Chỉ người nhận mới xác nhận được" }, { status: 403 });

  const updated = await prisma.settlement.update({
    where: { id },
    data: {
      isConfirmed: true,
      note: settlement.note?.startsWith("[QR_PENDING]")
        ? settlement.note.replace(/^\[QR_PENDING\]\s*/, "")
        : settlement.note,
    },
    include: {
      fromUser: { select: { displayName: true } },
      toUser: { select: { displayName: true } },
    },
  });

  // Send Notification to payer (fromUserId)
  await createNotification({
    userId: settlement.fromUserId,
    title: `Khoản thanh toán nợ đã được xác nhận`,
    content: `${session.user.name || "Người nhận"} đã xác nhận đã nhận khoản tiền ${formatVND(settlement.amount)} từ bạn.`,
    type: "SETTLEMENT_CONFIRMED",
    link: `/groups/${settlement.groupId}`,
    entityId: settlement.id,
  });

  // Phát sóng tin nhắn cập nhật cho tất cả client
  eventEmitter.emit(`group:${settlement.groupId}`, { type: "REFRESH" });

  // Gửi thông báo Zalo Bot cá nhân
  const msg = `🎉 [Xác nhận nhận tiền]
${updated.toUser.displayName} đã xác nhận nhận ${formatVND(updated.amount)} từ ${updated.fromUser.displayName}.
📌 Giao dịch hoàn tất!`;

  sendMultipleUsersZaloNotification([updated.fromUserId, updated.toUserId], msg);

  return NextResponse.json(updated);
}
