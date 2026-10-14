import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const CODE_TTL_MS = 10 * 60 * 1000;

// POST: Tạo mã liên kết Zalo mới — 6 số ngẫu nhiên, dùng 1 lần, hết hạn sau 10 phút.
// Mã cũ (nếu có) bị thay thế. Bot chỉ liên kết khi nhận đúng mã còn hạn (xem webhook/zalo).
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  // Mã phải là duy nhất giữa các user — thử lại nếu trùng
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(randomInt(100000, 1000000));
    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { zaloLinkCode: code, zaloLinkCodeExpires: expiresAt },
      });
      return NextResponse.json({ code, expiresAt });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }

  return NextResponse.json({ error: "Không tạo được mã, vui lòng thử lại" }, { status: 500 });
}
