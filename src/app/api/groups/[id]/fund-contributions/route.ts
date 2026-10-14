import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventEmitter } from "@/lib/events";
import { createNotification } from "@/lib/notifications";
import { sendUserZaloNotification } from "@/lib/zalo";
import { formatVND } from "@/lib/utils/format";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;
    const userId = session.user.id;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            bankName: true,
            accountNumber: true,
            accountName: true,
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: "Nhóm không tồn tại" }, { status: 404 });
    }

    const membership = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (!membership || membership.isLeft) {
      return NextResponse.json({ error: "Bạn không phải là thành viên trong nhóm" }, { status: 403 });
    }

    const { amount, note } = await req.json();
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Số tiền góp quỹ phải lớn hơn 0" }, { status: 400 });
    }

    const isOwner = group.ownerId === userId;
    const initialStatus = isOwner ? "CONFIRMED" : "PENDING";

    const contribution = await prisma.fundContribution.create({
      data: {
        amount: parsedAmount,
        note: note ? String(note).trim() : null,
        status: initialStatus,
        confirmedAt: isOwner ? new Date() : null,
        groupId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
          },
        },
      },
    });

    // Realtime SSE refresh
    eventEmitter.emit(`group:${groupId}`, { type: "REFRESH" });

    // Thông báo cho Trưởng nhóm nếu thành viên khác nộp quỹ
    if (!isOwner) {
      await createNotification({
        userId: group.ownerId,
        title: "Khoản góp quỹ mới chờ xác nhận",
        content: `${session.user.name || "Thành viên"} đã tạo yêu cầu góp quỹ ${formatVND(parsedAmount)} vào nhóm "${group.name}".`,
        type: "EXPENSE_PENDING",
        link: `/groups/${groupId}`,
        entityId: contribution.id,
      });

      const zaloMsg = `🏦 [Góp quỹ nhóm mới chờ duyệt]
👥 Nhóm: ${group.name}
👤 Người góp: ${session.user.name || "Thành viên"}
💰 Số tiền: ${formatVND(parsedAmount)}
📝 Ghi chú: ${contribution.note || "Góp quỹ hoạt động"}
📌 Cú pháp chuyển khoản: GQ${contribution.id}
👉 Vui lòng kiểm tra tài khoản ngân hàng và xác nhận trong nhóm.`;

      sendUserZaloNotification(group.ownerId, zaloMsg);
    }

    return NextResponse.json(contribution, { status: 201 });
  } catch (error: any) {
    console.error("[FundContribution POST] Error:", error);
    return NextResponse.json({ error: error.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
