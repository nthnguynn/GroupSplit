import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventEmitter } from "@/lib/events";
import { createNotification } from "@/lib/notifications";
import { formatVND } from "@/lib/utils/format";
import { sendUserZaloNotification, sendMultipleUsersZaloNotification } from "@/lib/zalo";

// Helper kiểm tra xem hoá đơn đã phát sinh thanh toán (Settlement) liên quan chưa
async function isExpenseLockedBySettlement(
  groupId: string,
  paidById: string,
  splits: { userId: string }[],
  createdAt: Date
): Promise<boolean> {
  const debtorIds = splits
    .map((s) => s.userId)
    .filter((id) => id !== paidById);

  if (debtorIds.length === 0) return false;

  const confirmedSettlement = await prisma.settlement.findFirst({
    where: {
      groupId,
      isConfirmed: true,
      createdAt: { gte: createdAt },
      OR: [
        { fromUserId: paidById, toUserId: { in: debtorIds } },
        { fromUserId: { in: debtorIds }, toUserId: paidById },
      ],
    },
    select: { id: true },
  });

  return !!confirmedSettlement;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: expenseId } = await params;
  const userId = session.user.id!;

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      splits: {
        include: {
          user: {
            select: { id: true, displayName: true, avatar: true },
          },
        },
      },
      paidBy: { select: { id: true, displayName: true, avatar: true } },
      createdBy: { select: { id: true, displayName: true } },
      categoryRel: true,
      group: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          fundManagerId: true,
          members: {
            where: { isLeft: false },
            include: {
              user: { select: { id: true, displayName: true, avatar: true } },
            },
          },
        },
      },
    },
  });

  if (!expense) {
    return NextResponse.json({ error: "Không tìm thấy hoá đơn" }, { status: 404 });
  }

  // Check if current user belongs to group
  const isMember = expense.group.members.some((m) => m.userId === userId);
  if (!isMember) {
    return NextResponse.json({ error: "Không thuộc nhóm này" }, { status: 403 });
  }

  const isLocked = await isExpenseLockedBySettlement(
    expense.groupId,
    expense.paidById,
    expense.splits,
    expense.createdAt
  );

  return NextResponse.json({ ...expense, isLocked });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: expenseId } = await params;
  const userId = session.user.id!;

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      splits: true,
      group: {
        select: {
          id: true,
          ownerId: true,
          fundManagerId: true,
        },
      },
    },
  });

  if (!expense) {
    return NextResponse.json({ error: "Không tìm thấy hoá đơn" }, { status: 404 });
  }

  // Check 1: User must be creator or group owner
  const isOwner = expense.group.ownerId === userId;
  const isCreator = expense.createdById === userId;
  if (!isCreator && !isOwner) {
    return NextResponse.json(
      { error: "Bạn không có quyền chỉnh sửa hoá đơn này" },
      { status: 403 }
    );
  }

  // Check 2: Chưa ai thanh toán tiền liên quan đến hoá đơn này
  const isLocked = await isExpenseLockedBySettlement(
    expense.groupId,
    expense.paidById,
    expense.splits,
    expense.createdAt
  );

  if (isLocked) {
    return NextResponse.json(
      {
        error:
          "Không thể chỉnh sửa hoá đơn này vì đã có thành viên thanh toán nợ liên quan.",
      },
      { status: 400 }
    );
  }

  const {
    title,
    description,
    amount,
    paidById,
    splitType,
    date,
    splits,
    category,
    categoryId,
    fundingSource,
  } = await req.json();

  if (!title || !amount || !paidById || !splits?.length) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  // Trưởng nhóm sửa -> APPROVED; Thành viên thường (kể cả Quản lý quỹ) sửa -> PENDING
  const isAutoApproved = isOwner;

  const nextStatus = isAutoApproved ? "APPROVED" : "PENDING";
  const finalFundingSource = fundingSource === "FUND" ? "FUND" : "MEMBER";

  try {
    const updatedExpense = await prisma.$transaction(async (tx) => {
      // 1. Xoá splits cũ
      await tx.expenseSplit.deleteMany({
        where: { expenseId },
      });

      // 2. Tạo splits mới và cập nhật expense
      return await tx.expense.update({
        where: { id: expenseId },
        data: {
          title,
          description: description || null,
          amount,
          paidById,
          splitType,
          date: date ? new Date(date) : new Date(),
          category: category || "Khác",
          categoryId: categoryId || null,
          fundingSource: finalFundingSource,
          status: nextStatus,
          splits: {
            create: splits.map(
              (s: { userId: string; amount: number; shares?: number }) => ({
                userId: s.userId,
                amount: s.amount,
                shares: s.shares ?? 1,
              })
            ),
          },
        },
        include: {
          splits: true,
          paidBy: { select: { displayName: true } },
          group: { select: { id: true, ownerId: true } },
        },
      });
    });

    // Phát sóng sự kiện cập nhật realtime cho nhóm
    eventEmitter.emit(`group:${expense.groupId}`, { type: "REFRESH" });

    // Gửi thông báo
    const groupId = expense.groupId;
    if (!isAutoApproved) {
      if (expense.group.ownerId !== userId) {
        await createNotification({
          userId: expense.group.ownerId,
          title: `Hóa đơn đã được chỉnh sửa`,
          content: `${session.user.name || "Thành viên"} đã chỉnh sửa hóa đơn "${title}" (${formatVND(amount)}) và đang chờ bạn duyệt lại.`,
          type: "EXPENSE_PENDING",
          link: `/groups/${groupId}`,
          entityId: expenseId,
        });

        const zaloMsg = `🧾 [Hóa đơn đã chỉnh sửa - Chờ duyệt]
📌 ${title}
💰 Tổng hóa đơn mới: ${formatVND(amount)}
👤 Người sửa: ${session.user.name || "Thành viên"}
👤 Người chi: ${updatedExpense.paidBy.displayName}
🏷️ Danh mục: ${category || "Khác"}
📌 Trạng thái: ⏳ Chờ Trưởng nhóm duyệt lại
👉 Vui lòng vào nhóm để kiểm tra.`;

        sendUserZaloNotification(expense.group.ownerId, zaloMsg);
      }
    } else {
      for (const split of updatedExpense.splits) {
        if (split.userId !== userId) {
          const sharesSuffix =
            split.shares && split.shares !== 1 ? ` (x${split.shares} suất)` : "";
          await createNotification({
            userId: split.userId,
            title: `Hóa đơn đã được cập nhật`,
            content: `Hóa đơn "${title}" (${formatVND(amount)}) vừa được cập nhật. Phần của bạn: ${formatVND(split.amount)}${sharesSuffix}.`,
            type: "EXPENSE_APPROVED",
            link: `/groups/${groupId}`,
            entityId: expenseId,
          });
        }
      }

      const targetUserIds = Array.from(
        new Set([paidById, ...updatedExpense.splits.map((s) => s.userId)])
      );

      for (const targetUserId of targetUserIds) {
        const userSplit = updatedExpense.splits.find((s) => s.userId === targetUserId);
        const isPayer = targetUserId === paidById;
        const payerNote = isPayer ? " (Bạn đã trả)" : "";
        const sharesSuffix =
          userSplit?.shares && userSplit.shares !== 1 ? ` (x${userSplit.shares} suất)` : "";

        const shareLine = userSplit
          ? `💵 Phần của bạn: ${formatVND(userSplit.amount)}${sharesSuffix}`
          : "";

        const msg = `🧾 [Hóa đơn đã cập nhật]
📌 ${title}
💰 Tổng hóa đơn: ${formatVND(amount)}
${shareLine ? `${shareLine}\n` : ""}👤 Người chi: ${updatedExpense.paidBy.displayName}${payerNote}
🏷️ Danh mục: ${category || "Khác"}
📌 Trạng thái: 🟢 Đã cập nhật`;

        sendUserZaloNotification(targetUserId, msg);
      }
    }

    return NextResponse.json(updatedExpense);
  } catch (error: any) {
    console.error("Update expense error:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi hệ thống khi cập nhật hoá đơn" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: expenseId } = await params;
  const userId = session.user.id!;

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      splits: true,
      paidBy: { select: { displayName: true } },
      group: {
        select: {
          id: true,
          ownerId: true,
        },
      },
    },
  });

  if (!expense) {
    return NextResponse.json({ error: "Không tìm thấy hoá đơn" }, { status: 404 });
  }

  // Phân quyền: Chỉ duy nhất Trưởng nhóm mới có quyền xoá hoá đơn
  const isOwner = expense.group.ownerId === userId;
  if (!isOwner) {
    return NextResponse.json(
      { error: "Chỉ Trưởng nhóm mới có quyền xoá hoá đơn" },
      { status: 403 }
    );
  }

  // Điều kiện: Chưa ai thanh toán tiền liên quan đến hoá đơn này
  const isLocked = await isExpenseLockedBySettlement(
    expense.groupId,
    expense.paidById,
    expense.splits,
    expense.createdAt
  );

  if (isLocked) {
    return NextResponse.json(
      {
        error:
          "Không thể xoá hoá đơn này vì đã có thành viên thanh toán nợ liên quan.",
      },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.expenseSplit.deleteMany({
        where: { expenseId },
      });
      await tx.expense.delete({
        where: { id: expenseId },
      });
    });

    // Phát sóng sự kiện cập nhật realtime cho nhóm
    eventEmitter.emit(`group:${expense.groupId}`, { type: "REFRESH" });

    // Gửi thông báo cho người tạo và người chi trả (nếu khác trưởng nhóm)
    const notifyUserIds = Array.from(
      new Set([expense.createdById, expense.paidById])
    ).filter((uid) => uid !== userId);

    for (const targetUserId of notifyUserIds) {
      await createNotification({
        userId: targetUserId,
        title: `Hóa đơn đã bị xoá`,
        content: `Trưởng nhóm đã xoá hóa đơn "${expense.title}" (${formatVND(expense.amount)}) khỏi nhóm.`,
        type: "EXPENSE_REJECTED",
        link: `/groups/${expense.groupId}`,
      });
    }

    if (notifyUserIds.length > 0) {
      const zaloMsg = `🗑️ [Hóa đơn đã bị xoá]
📌 Trưởng nhóm đã xoá hoá đơn: "${expense.title}"
💰 Số tiền: ${formatVND(expense.amount)}
👤 Người xoá: Trưởng nhóm`;
      sendMultipleUsersZaloNotification(notifyUserIds, zaloMsg);
    }

    return NextResponse.json({ success: true, message: "Đã xoá hoá đơn thành công" });
  } catch (error: any) {
    console.error("Delete expense error:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi hệ thống khi xoá hoá đơn" },
      { status: 500 }
    );
  }
}
