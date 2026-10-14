import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendDirectZaloTest } from "@/lib/zalo";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { zaloChatId: true, displayName: true },
    });

    if (!user?.zaloChatId?.trim()) {
      return NextResponse.json(
        { error: "Bạn chưa liên kết Zalo Chat ID cá nhân" },
        { status: 400 }
      );
    }

    await sendDirectZaloTest(user.zaloChatId, user.displayName);

    return NextResponse.json({
      success: true,
      message: "Đã gửi tin nhắn Zalo thử nghiệm thành công!",
    });
  } catch (err: any) {
    console.error("Test user zalo error:", err);
    return NextResponse.json(
      { error: err.message || "Không thể gửi tin nhắn thử nghiệm Zalo." },
      { status: 400 }
    );
  }
}
