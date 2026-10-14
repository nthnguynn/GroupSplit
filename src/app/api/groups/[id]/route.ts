import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { eventEmitter } from "@/lib/events";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: groupId } = await params;
    const userId = session.user.id!;

    // Verify group exists and user is owner
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: "Nhóm không tồn tại" }, { status: 404 });
    if (group.ownerId !== userId) {
      return NextResponse.json(
        { error: "Chỉ trưởng nhóm mới được sửa cài đặt nhóm" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string | null;
    const avatarFile = formData.get("avatar") as File | null;

    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Tên nhóm không được để trống" }, { status: 400 });
    }

    let avatarUrl: string | undefined = undefined;

    // Handle group avatar upload
    if (avatarFile && avatarFile.size > 0 && avatarFile.name) {
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });

      const fileExt = path.extname(avatarFile.name) || ".jpg";
      const fileName = `group-${groupId}-${Date.now()}${fileExt}`;
      const filePath = path.join(uploadDir, fileName);

      const buffer = Buffer.from(await avatarFile.arrayBuffer());
      await writeFile(filePath, buffer);

      avatarUrl = `/uploads/${fileName}`;
    }

    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        ...(avatarUrl !== undefined ? { avatar: avatarUrl } : {}),
      },
    });

    // Notify all members via real-time SSE
    eventEmitter.emit(`group:${groupId}`, { type: "REFRESH" });

    return NextResponse.json(updatedGroup, { status: 200 });
  } catch (err: any) {
    console.error("Lỗi cập nhật cài đặt nhóm:", err);
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: groupId } = await params;
    const userId = session.user.id!;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { where: { isLeft: false } },
      },
    });

    if (!group) return NextResponse.json({ error: "Nhóm không tồn tại" }, { status: 404 });

    // Chỉ Trưởng nhóm mới có quyền xoá nhóm
    if (group.ownerId !== userId) {
      return NextResponse.json(
        { error: "Chỉ Trưởng nhóm mới có quyền xoá nhóm này" },
        { status: 403 }
      );
    }

    const memberIdsToNotify = group.members
      .map((m) => m.userId)
      .filter((uid) => uid !== userId);

    await prisma.$transaction(async (tx) => {
      // 1. Xoá splits của các hoá đơn trong nhóm
      const expenses = await tx.expense.findMany({
        where: { groupId },
        select: { id: true },
      });
      const expenseIds = expenses.map((e) => e.id);
      if (expenseIds.length > 0) {
        await tx.expenseSplit.deleteMany({
          where: { expenseId: { in: expenseIds } },
        });
        await tx.expense.deleteMany({
          where: { groupId },
        });
      }

      // 2. Xoá settlements
      await tx.settlement.deleteMany({ where: { groupId } });

      // 3. Xoá fund allocations
      await tx.fundAllocation.deleteMany({ where: { groupId } });

      // 4. Xoá categories
      await tx.category.deleteMany({ where: { groupId } });

      // 5. Xoá group invitations & join requests
      await tx.groupInvitation.deleteMany({ where: { groupId } });
      await tx.groupJoinRequest.deleteMany({ where: { groupId } });

      // 6. Xoá members
      await tx.groupMember.deleteMany({ where: { groupId } });

      // 7. Xoá group
      await tx.group.delete({ where: { id: groupId } });
    });

    // Thông báo cho các thành viên còn lại
    const { createNotification } = await import("@/lib/notifications");
    for (const memberId of memberIdsToNotify) {
      createNotification({
        userId: memberId,
        title: `Nhóm đã bị giải tán`,
        content: `Trưởng nhóm đã giải tán và xoá nhóm "${group.name}".`,
        type: "MEMBER_LEFT",
        link: `/groups`,
      }).catch(console.error);
    }

    // Phát sóng sự kiện giải tán nhóm
    eventEmitter.emit(`group:${groupId}`, { type: "REFRESH" });

    return NextResponse.json({
      success: true,
      message: `Đã xoá nhóm "${group.name}" thành công`,
    });
  } catch (err: any) {
    console.error("Lỗi khi xoá nhóm:", err);
    return NextResponse.json(
      { error: err.message || "Lỗi máy chủ khi xoá nhóm" },
      { status: 500 }
    );
  }
}

