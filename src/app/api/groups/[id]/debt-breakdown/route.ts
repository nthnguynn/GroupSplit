import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: Hóa đơn đã duyệt giữa 2 người (?a=&b=) cho hộp thoại "Bảng kê chi tiết dư nợ".
// Tải theo yêu cầu khi mở hộp thoại thay vì gửi toàn bộ hóa đơn của nhóm xuống trang.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const userId = session.user.id!;
  const a = req.nextUrl.searchParams.get("a");
  const b = req.nextUrl.searchParams.get("b");
  if (!a || !b) {
    return NextResponse.json({ error: "Thiếu tham số a, b" }, { status: 400 });
  }

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { isLeft: true },
  });
  if (!membership || membership.isLeft) {
    return NextResponse.json({ error: "Bạn không thuộc nhóm này" }, { status: 403 });
  }

  const expenses = await prisma.expense.findMany({
    where: {
      groupId,
      status: "APPROVED",
      OR: [
        { paidById: a, splits: { some: { userId: b, amount: { gt: 0 } } } },
        { paidById: b, splits: { some: { userId: a, amount: { gt: 0 } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      amount: true,
      paidById: true,
      date: true,
      category: true,
      // Hộp thoại chỉ đọc phần chia của 2 người này
      splits: {
        where: { userId: { in: [a, b] } },
        select: { userId: true, amount: true },
      },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
}
