import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/user-select";
import { calculateDebts } from "@/lib/debt-calculator";
import { createNotification } from "@/lib/notifications";
import { eventEmitter } from "@/lib/events";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const userId = session.user.id!;

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

  const membership = group.members.find((m) => m.userId === userId);
  if (!membership || membership.isLeft) {
    return NextResponse.json({ error: "Bạn không thuộc nhóm này hoặc đã rời nhóm" }, { status: 400 });
  }

  // Group Owner cannot leave directly
  if (group.ownerId === userId) {
    return NextResponse.json(
      { error: "Trưởng nhóm không thể rời nhóm trực tiếp. Vui lòng chuyển quyền Trưởng nhóm cho thành viên khác trước." },
      { status: 400 }
    );
  }

  // Calculate user balance
  const { balances } = calculateDebts(
    group.expenses,
    group.members,
    group.settlements,
    group.ownerId,
    group.fundAllocations
  );

  const myBalance = balances.find((b) => b.userId === userId)?.balance ?? 0;

  if (Math.abs(myBalance) > 0.01) {
    return NextResponse.json(
      { error: "Bạn không thể rời nhóm do vẫn còn dư nợ chưa thanh toán hết (Dư nợ phải bằng 0đ)." },
      { status: 400 }
    );
  }

  // Mark member as left
  await prisma.groupMember.update({
    where: { userId_groupId: { userId, groupId } },
    data: {
      isLeft: true,
      leftAt: new Date(),
    },
  });

  // Notify Owner
  await createNotification({
    userId: group.ownerId,
    title: `Thành viên rời nhóm`,
    content: `${session.user.name || "Thành viên"} đã rời khỏi nhóm "${group.name}".`,
    type: "MEMBER_LEFT",
    link: `/groups/${groupId}`,
    entityId: groupId,
  });

  // Emit SSE refresh
  eventEmitter.emit(`group:${groupId}`, { type: "REFRESH" });

  return NextResponse.json({ message: `Đã rời khỏi nhóm "${group.name}" thành công` });
}
