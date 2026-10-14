import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventEmitter } from "@/lib/events";
import { createNotification } from "@/lib/notifications";
import { sendMultipleUsersZaloNotification } from "@/lib/zalo";
import { formatVND } from "@/lib/utils/format";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id!;

  try {
    const settlement = await prisma.settlement.findUnique({ where: { id } });
    if (!settlement) {
      return NextResponse.json({ error: "Không tìm thấy giao dịch" }, { status: 404 });
    }

    // Cho phép người gửi hủy giao dịch (khi đóng popup) hoặc người nhận từ chối (khi chưa nhận được tiền)
    if (settlement.fromUserId !== userId && settlement.toUserId !== userId) {
      return NextResponse.json(
        { error: "Bạn không có quyền hủy hoặc từ chối giao dịch này" },
        { status: 403 }
      );
    }

    // Xóa bản ghi settlement để hủy yêu cầu thanh toán
    await prisma.settlement.delete({ where: { id } });

    // Phát sóng tin nhắn cập nhật cho tất cả client
    eventEmitter.emit(`group:${settlement.groupId}`, { type: "REFRESH" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reject settlement error:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id!;

  try {
    const { note } = await req.json();

    const settlement = await prisma.settlement.findUnique({ where: { id } });
    if (!settlement) {
      return NextResponse.json({ error: "Không tìm thấy giao dịch" }, { status: 404 });
    }

    if (settlement.fromUserId !== userId) {
      return NextResponse.json(
        { error: "Bạn không có quyền chỉnh sửa giao dịch này" },
        { status: 403 }
      );
    }

    const updated = await prisma.settlement.update({
      where: { id },
      data: { note },
      include: {
        fromUser: { select: { displayName: true } },
        toUser: { select: { displayName: true } },
      },
    });

    // Nếu chuyển từ trạng thái nháp [QR_PENDING] sang xác nhận đã chuyển xong thủ công
    if (settlement.note?.startsWith("[QR_PENDING]") && !note?.startsWith("[QR_PENDING]")) {
      await createNotification({
        userId: settlement.toUserId,
        title: `Yêu cầu xác nhận nhận tiền`,
        content: `${session.user.name || "Thành viên"} đã đánh dấu trả cho bạn số tiền ${formatVND(settlement.amount)}. Vui lòng kiểm tra và xác nhận.`,
        type: "SETTLEMENT_PENDING",
        link: `/groups/${settlement.groupId}`,
        entityId: settlement.id,
      });

      const msg = `💸 [Thông báo chuyển tiền]
${updated.fromUser.displayName} ➔ ${updated.toUser.displayName}
💰 Số tiền: ${formatVND(updated.amount)}
📝 Chi tiết: ${note || "Chuyển khoản VietQR"}
⏳ Trạng thái: Đã chuyển (Chờ xác nhận)`;

      sendMultipleUsersZaloNotification([settlement.fromUserId, settlement.toUserId], msg);
    }

    // Phát sóng tin nhắn cập nhật cho tất cả client
    eventEmitter.emit(`group:${settlement.groupId}`, { type: "REFRESH" });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update settlement error:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
