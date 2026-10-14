import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventEmitter } from "@/lib/events";
import { createNotification } from "@/lib/notifications";
import { formatVND } from "@/lib/utils/format";
import { sendUserZaloNotification } from "@/lib/zalo";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const userId = session.user.id!;

  // Check group & membership
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { ownerId: true, fundManagerId: true },
  });
  if (!group) return NextResponse.json({ error: "Nhóm không tồn tại" }, { status: 404 });

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership) return NextResponse.json({ error: "Không thuộc nhóm này" }, { status: 403 });

  const { title, description, amount, paidById, splitType, date, splits, category, categoryId, fundingSource } =
    await req.json();

  const finalFundingSource = fundingSource === "FUND" ? "FUND" : "MEMBER";

  if (!title || !amount || !paidById || !splits?.length) {
    return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
  }

  // Tự động duyệt hoá đơn nếu do chính Trưởng nhóm tạo
  const isAutoApproved =
    membership.role === "OWNER" ||
    group.ownerId === userId;

  try {
    const isApproved = isAutoApproved;
    const expense = await prisma.expense.create({
      data: {
        title,
        description,
        amount,
        paidById,
        splitType,
        date: date ? new Date(date) : new Date(),
        groupId,
        createdById: userId,
        status: isApproved ? "APPROVED" : "PENDING",
        category: category || "Khác",
        categoryId: categoryId || null,
        fundingSource: finalFundingSource,
        splits: {
          create: splits.map((s: { userId: string; amount: number; shares?: number }) => ({
            userId: s.userId,
            amount: s.amount,
            shares: s.shares ?? 1,
          })),
        },
      },
      include: { splits: true, paidBy: { select: { displayName: true } } },
    });

    // Phát sóng tin nhắn cập nhật cho tất cả client
    eventEmitter.emit(`group:${groupId}`, { type: "REFRESH" });

    // 1. Nếu hóa đơn CẦN DUYỆT (PENDING): CHỈ thông báo duy nhất đến Trưởng nhóm
    if (!isApproved) {
      if (group.ownerId !== userId) {
        // Thông báo In-app cho Trưởng nhóm
        await createNotification({
          userId: group.ownerId,
          title: `Hóa đơn mới chờ duyệt`,
          content: `${session.user.name || "Thành viên"} đã tạo hóa đơn "${title}" (${formatVND(amount)}) cần bạn duyệt.`,
          type: "EXPENSE_PENDING",
          link: `/groups/${groupId}`,
          entityId: expense.id,
        });

        // Thông báo Zalo Bot cá nhân cho Trưởng nhóm
        const zaloMsg = `🧾 [Hóa đơn mới chờ duyệt]
📌 ${title}
💰 Tổng hóa đơn: ${formatVND(amount)}
👤 Người tạo: ${session.user.name || "Thành viên"}
👤 Người chi: ${expense.paidBy.displayName}
🏷️ Danh mục: ${category || "Khác"}
📌 Trạng thái: ⏳ Chờ Trưởng nhóm duyệt
👉 Vui lòng vào nhóm để duyệt hóa đơn.`;

        sendUserZaloNotification(group.ownerId, zaloMsg);
      }
    } else {
      // 2. Nếu hóa đơn ĐÃ TỰ ĐỘNG DUYỆT: Thông báo đến tất cả người liên quan đến hóa đơn
      // 2.1 Thông báo In-app cho những người liên quan (không gửi cho chính người tạo)
      for (const split of expense.splits) {
        if (split.userId !== userId) {
          const sharesSuffix = split.shares && split.shares !== 1 ? ` (x${split.shares} suất)` : "";
          await createNotification({
            userId: split.userId,
            title: `Hóa đơn mới liên quan đến bạn`,
            content: `Hóa đơn "${title}" (${formatVND(amount)}) do ${expense.paidBy.displayName} chi trả. Phần của bạn: ${formatVND(split.amount)}${sharesSuffix}.`,
            type: "EXPENSE_APPROVED",
            link: `/groups/${groupId}`,
            entityId: expense.id,
          });
        }
      }

      // Nếu người trả tiền khác người tạo và không nằm trong splits
      if (paidById !== userId && !expense.splits.some((s) => s.userId === paidById)) {
        await createNotification({
          userId: paidById,
          title: `Hóa đơn mới được ghi nhận`,
          content: `Hóa đơn "${title}" (${formatVND(amount)}) do bạn chi trả đã được ghi nhận vào nhóm.`,
          type: "EXPENSE_APPROVED",
          link: `/groups/${groupId}`,
          entityId: expense.id,
        });
      }

      // 2.2 Gửi thông báo Zalo Bot cá nhân cho từng người liên quan kèm số tiền phần của người đó
      const targetUserIds = Array.from(
        new Set([paidById, ...expense.splits.map((s) => s.userId)])
      );

      for (const targetUserId of targetUserIds) {
        const userSplit = expense.splits.find((s) => s.userId === targetUserId);
        const isPayer = targetUserId === paidById;
        const payerNote = isPayer ? " (Bạn đã trả)" : "";
        const sharesSuffix = userSplit?.shares && userSplit.shares !== 1 ? ` (x${userSplit.shares} suất)` : "";

        const shareLine = userSplit
          ? `💵 Phần của bạn: ${formatVND(userSplit.amount)}${sharesSuffix}`
          : "";

        const msg = `🧾 [Hóa đơn mới]
📌 ${title}
💰 Tổng hóa đơn: ${formatVND(amount)}
${shareLine ? `${shareLine}\n` : ""}👤 Người chi: ${expense.paidBy.displayName}${payerNote}
🏷️ Danh mục: ${category || "Khác"}
📌 Trạng thái: 🟢 Đã duyệt`;

        sendUserZaloNotification(targetUserId, msg);
      }
    }

    return NextResponse.json(expense, { status: 201 });
  } catch (error: any) {
    console.error("Create expense error:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi hệ thống khi tạo hoá đơn" },
      { status: 500 }
    );
  }
}
