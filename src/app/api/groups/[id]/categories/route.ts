import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventEmitter } from "@/lib/events";

// GET: Lấy danh sách danh mục của nhóm
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const userId = session.user.id!;

  // Kiểm tra thành viên nhóm
  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Bạn không thuộc nhóm này" }, { status: 403 });
  }

  const categories = await prisma.category.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(categories);
}

// POST: Tạo danh mục mới trong nhóm
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: groupId } = await params;
  const userId = session.user.id!;

  // Chỉ trưởng nhóm (Owner) mới được quản lý danh mục
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Nhóm không tồn tại" }, { status: 404 });
  if (group.ownerId !== userId) {
    return NextResponse.json({ error: "Chỉ trưởng nhóm mới được tạo danh mục" }, { status: 403 });
  }

  try {
    const { name, icon, parentId } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Tên danh mục không được để trống" }, { status: 400 });
    }

    // Kiểm tra trùng tên danh mục trong cùng một thư mục cha
    const existing = await prisma.category.findFirst({
      where: {
        groupId,
        name: name.trim(),
        parentId: parentId || null,
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Tên danh mục đã tồn tại ở cấp này" }, { status: 400 });
    }

    // Nếu có parentId, kiểm tra parentId có tồn tại trong nhóm này không
    if (parentId) {
      const parent = await prisma.category.findFirst({
        where: { id: parentId, groupId },
      });
      if (!parent) {
        return NextResponse.json({ error: "Danh mục cha không hợp lệ" }, { status: 400 });
      }
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        icon: icon || "📦",
        parentId: parentId || null,
        groupId,
      },
    });

    // Phát tín hiệu đồng bộ real-time
    eventEmitter.emit(`group:${groupId}`, { type: "REFRESH" });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Create category error:", error);
    return NextResponse.json({ error: "Lỗi server khi tạo danh mục" }, { status: 500 });
  }
}
