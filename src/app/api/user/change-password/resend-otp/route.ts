import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendPasswordChangeOtpEmail } from "@/lib/email";
import { sendPasswordChangeZaloOtp } from "@/lib/zalo";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { channel } = await req.json().catch(() => ({}));
    const userId = session.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        isEmailVerified: true,
        zaloChatId: true,
        passwordResetToken: true,
      },
    });

    if (!user || !user.passwordResetToken) {
      return NextResponse.json(
        { error: "Không có yêu cầu đổi mật khẩu nào đang diễn ra" },
        { status: 400 }
      );
    }

    const parts = user.passwordResetToken.split(":");
    if (parts.length < 3 || parts[0] !== "CHANGE_PWD") {
      return NextResponse.json(
        { error: "Dữ liệu xác thực không hợp lệ. Vui lòng thực hiện lại từ đầu." },
        { status: 400 }
      );
    }

    const [, , newPasswordHash, defaultChannel] = parts;
    const chosenChannel = channel || defaultChannel || (user.email && user.isEmailVerified ? "email" : "zalo");

    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: `CHANGE_PWD:${newOtpCode}:${newPasswordHash}:${chosenChannel}`,
        passwordResetExpires: newExpires,
      },
    });

    if (chosenChannel === "email" && user.email) {
      await sendPasswordChangeOtpEmail(user.email, newOtpCode, user.username);
      return NextResponse.json({
        success: true,
        channel: "email",
        targetDesc: `Email (${user.email})`,
        message: `Đã gửi lại mã OTP mới đến Email: ${user.email}`,
      });
    }

    if (chosenChannel === "zalo" && user.zaloChatId) {
      await sendPasswordChangeZaloOtp(user.zaloChatId, newOtpCode, user.username);
      return NextResponse.json({
        success: true,
        channel: "zalo",
        targetDesc: `Zalo Bot (Chat ID: ${user.zaloChatId})`,
        message: `Đã gửi lại mã OTP mới qua Zalo Bot!`,
      });
    }

    return NextResponse.json(
      { error: "Không tìm thấy thông tin kênh nhận OTP hợp lệ" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Resend change password OTP error:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi máy chủ khi gửi lại mã OTP" },
      { status: 500 }
    );
  }
}
