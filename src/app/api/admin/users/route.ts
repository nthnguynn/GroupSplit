import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

async function verifyAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user as any;
  if (user.role !== "ADMIN") return null;
  return user;
}

// 1. GET: Lấy danh sách tất cả người dùng
export async function GET(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Quyền truy cập bị từ chối" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        isEmailVerified: true,
        role: true,
        zaloChatId: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        createdAt: true,
        _count: {
          select: {
            groupMemberships: true,
            paidExpenses: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. PATCH: Cập nhật thông tin/quyền hạn người dùng từ Admin
export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Quyền truy cập bị từ chối" }, { status: 403 });
  }

  try {
    const { userId, isEmailVerified, role, newPassword } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Thiếu userId" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
    }

    // Không cho Admin tự hạ quyền / hủy xác thực chính mình (tránh mất hết tài khoản Admin)
    if (userId === admin.id && (role === "USER" || isEmailVerified === false)) {
      return NextResponse.json(
        { error: "Không thể tự hạ quyền hoặc hủy xác thực tài khoản của chính bạn" },
        { status: 400 }
      );
    }

    const updateData: any = {};

    if (typeof isEmailVerified === "boolean") {
      updateData.isEmailVerified = isEmailVerified;
    }

    if (role && (role === "ADMIN" || role === "USER")) {
      updateData.role = role;
    }

    if (newPassword && newPassword.trim().length >= 6) {
      updateData.passwordHash = await hashPassword(newPassword.trim());
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        isEmailVerified: true,
        role: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã cập nhật thông tin người dùng @${updated.username}!`,
      user: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
