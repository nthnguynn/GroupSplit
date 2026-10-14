import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventEmitter } from "@/lib/events";
import { createNotification } from "@/lib/notifications";
import { sendUserZaloNotification } from "@/lib/zalo";
import { formatVND } from "@/lib/utils/format";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;
    const { status } = await req.json();

    if (!["CONFIRMED", "REJECTED"].includes(status)) {
      return NextResponse.json({ error: "Trạng thái không hợp lệ" }, { status: 400 });
    }

    const contribution = await prisma.fundContribution.findUnique({
      where: { id },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    if (!contribution) {
      return NextResponse.json({ error: "Không tìm thấy khoản góp quỹ" }, { status: 404 });
    }

    if (contribution.group.ownerId !== userId) {
      return NextResponse.json({ error: "Chỉ Trưởng nhóm mới có quyền xác nhận khoản góp quỹ" }, { status: 403 });
    }

    const updated = await prisma.fundContribution.update({
      where: { id },
      data: {
        status,
        confirmedAt: status === "CONFIRMED" ? new Date() : null,
      },
    });

    // Realtime SSE
    eventEmitter.emit(`group:${contribution.groupId}`, { type: "REFRESH" });

    // Thông báo cho người góp quỹ nếu người duyệt khác người nộp
    if (contribution.userId !== userId) {
      const isConfirmed = status === "CONFIRMED";
      const title = isConfirmed ? "Khoản góp quỹ đã được xác nhận" : "Khoản góp quỹ bị từ chối";
      const content = isConfirmed
        ? `Trưởng nhóm đã xác nhận khoản góp quỹ ${formatVND(contribution.amount)} của bạn vào nhóm "${contribution.group.name}".`
        : `Khoản góp quỹ ${formatVND(contribution.amount)} vào nhóm "${contribution.group.name}" đã bị từ chối.`;

      await createNotification({
        userId: contribution.userId,
        title,
        content,
        type: isConfirmed ? "EXPENSE_APPROVED" : "EXPENSE_REJECTED",
        link: `/groups/${contribution.groupId}`,
        entityId: contribution.id,
      });

      const zaloMsg = `🏦 [${title}]
👥 Nhóm: ${contribution.group.name}
💰 Số tiền: ${formatVND(contribution.amount)}
📌 Trạng thái: ${isConfirmed ? "🟢 Đã ghi nhận vào Quỹ nhóm" : "🔴 Đã từ chối"}
${isConfirmed ? "Cảm ơn bạn đã đóng góp vào quỹ hoạt động chung!" : "Vui lòng liên hệ Trưởng nhóm để biết thêm chi tiết."}`;

      sendUserZaloNotification(contribution.userId, zaloMsg);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[FundContribution PATCH] Error:", error);
    return NextResponse.json({ error: error.message || "Lỗi máy chủ" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;

    const contribution = await prisma.fundContribution.findUnique({
      where: { id },
      include: {
        group: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    });

    if (!contribution) {
      return NextResponse.json({ error: "Không tìm thấy khoản góp quỹ" }, { status: 404 });
    }

    const isOwner = contribution.group.ownerId === userId;
    const isContributor = contribution.userId === userId;

    if (!isOwner && !isContributor) {
      return NextResponse.json({ error: "Bạn không có quyền xoá khoản góp quỹ này" }, { status: 403 });
    }

    // Nếu người đóng góp muốn xoá, chỉ cho phép khi vẫn PENDING
    if (isContributor && !isOwner && contribution.status === "CONFIRMED") {
      return NextResponse.json({ error: "Khoản góp quỹ đã được xác nhận, không thể xoá" }, { status: 400 });
    }

    await prisma.fundContribution.delete({
      where: { id },
    });

    eventEmitter.emit(`group:${contribution.groupId}`, { type: "REFRESH" });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[FundContribution DELETE] Error:", error);
    return NextResponse.json({ error: error.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
