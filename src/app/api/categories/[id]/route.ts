import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventEmitter } from "@/lib/events";

// PATCH: Chỉnh sửa danh mục
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id!;

  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { group: true },
    });

    if (!category) {
      return NextResponse.json({ error: "Danh mục không tồn tại" }, { status: 404 });
    }

    // Chỉ Trưởng nhóm mới được sửa danh mục
    if (category.group.ownerId !== userId) {
      return NextResponse.json({ error: "Chỉ trưởng nhóm mới được sửa danh mục" }, { status: 403 });
    }

    const { name, icon } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Tên danh mục không được để trống" }, { status: 400 });
    }

    // Không cho phép sửa danh mục mặc định "Khác" thành tên khác
    if (category.name === "Khác" && category.parentId === null && name.trim() !== "Khác") {
      return NextResponse.json({ error: "Không thể đổi tên danh mục mặc định 'Khác'" }, { status: 400 });
    }

    // Kiểm tra trùng tên ở cùng cấp độ
    const existing = await prisma.category.findFirst({
      where: {
        groupId: category.groupId,
        name: name.trim(),
        parentId: category.parentId,
        NOT: { id },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Tên danh mục đã tồn tại ở cấp này" }, { status: 400 });
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: name.trim(),
        icon: icon || "📦",
      },
    });

    // Phát tín hiệu đồng bộ real-time
    eventEmitter.emit(`group:${category.groupId}`, { type: "REFRESH" });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update category error:", error);
    return NextResponse.json({ error: "Lỗi server khi cập nhật danh mục" }, { status: 500 });
  }
}

// DELETE: Xóa danh mục (Di chuyển toàn bộ hóa đơn con cháu sang danh mục mặc định "Khác")
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const userId = session.user.id!;

  try {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { group: true },
    });

    if (!category) {
      return NextResponse.json({ error: "Danh mục không tồn tại" }, { status: 404 });
    }

    // Chỉ Trưởng nhóm mới được xóa danh mục
    if (category.group.ownerId !== userId) {
      return NextResponse.json({ error: "Chỉ trưởng nhóm mới được xóa danh mục" }, { status: 403 });
    }

    // Không cho phép xóa danh mục mặc định "Khác" cấp gốc
    if (category.name === "Khác" && category.parentId === null) {
      return NextResponse.json({ error: "Không thể xóa danh mục mặc định 'Khác'" }, { status: 400 });
    }

    // 1. Tìm danh mục "Khác" mặc định của nhóm (Tạo mới nếu chưa có vì lý do nào đó)
    let defaultCategory = await prisma.category.findFirst({
      where: { groupId: category.groupId, name: "Khác", parentId: null },
    });

    if (!defaultCategory) {
      defaultCategory = await prisma.category.create({
        data: {
          name: "Khác",
          icon: "📦",
          groupId: category.groupId,
        },
      });
    }

    // 2. Tìm đệ quy toàn bộ ID của các danh mục con cháu
    const descendants: { id: string }[] = await prisma.$queryRawUnsafe(
      `WITH RECURSIVE subcategories AS (
        SELECT id FROM "Category" WHERE id = $1
        UNION ALL
        SELECT c.id FROM "Category" c
        INNER JOIN subcategories s ON c."parentId" = s.id
      )
      SELECT id FROM subcategories`,
      id
    );

    const allCategoryIds = descendants.map((d) => d.id);

    // 3. Cập nhật toàn bộ Expense thuộc các danh mục này sang danh mục "Khác" mặc định
    await prisma.expense.updateMany({
      where: { categoryId: { in: allCategoryIds } },
      data: {
        categoryId: defaultCategory.id,
        category: "Khác", // Fallback string sync
      },
    });

    // 4. Xóa danh mục cha (onDelete: Cascade trên Prisma sẽ tự động xóa các danh mục con trong database)
    await prisma.category.delete({
      where: { id },
    });

    // Phát tín hiệu đồng bộ real-time
    eventEmitter.emit(`group:${category.groupId}`, { type: "REFRESH" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete category error:", error);
    return NextResponse.json({ error: "Lỗi server khi xóa danh mục" }, { status: 500 });
  }
}
