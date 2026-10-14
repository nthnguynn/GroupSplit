import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/user-select";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;
  const { name, description } = await req.json();

  // Check if the user has integrated SePay & filled bank info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bankName: true, accountNumber: true, accountName: true, sepayWebhookSecret: true },
  });

  if (!user?.bankName || !user?.accountNumber || !user?.accountName || !user?.sepayWebhookSecret) {
    return NextResponse.json(
      { error: "Bạn cần hoàn tất cấu hình thông tin ngân hàng và SePay Webhook trong mục Cài đặt trước khi tạo nhóm mới." },
      { status: 403 }
    );
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: "Tên nhóm không được để trống" }, { status: 400 });
  }

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });

  return NextResponse.json(group, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { include: { user: { select: publicUserSelect } } },
      _count: { select: { expenses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(groups);
}
