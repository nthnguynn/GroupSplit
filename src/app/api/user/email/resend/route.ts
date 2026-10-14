import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailChangeOldOtp, sendEmailChangeNewOtp } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        isEmailVerified: true,
        emailVerificationToken: true,
      },
    });

    if (!user || !user.emailVerificationToken) {
      return NextResponse.json(
        { error: "Không có tiến trình xác thực nào đang diễn ra" },
        { status: 400 }
      );
    }

    const parts = user.emailVerificationToken.split(":");
    if (parts.length < 3) {
      return NextResponse.json(
        { error: "Dữ liệu xác thực không hợp lệ. Vui lòng thực hiện lại từ đầu." },
        { status: 400 }
      );
    }

    const [type, , newEmail] = parts;
    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: `${type}:${newOtpCode}:${newEmail}`,
        emailVerificationExpires: newExpires,
      },
    });

    if (type === "OLD" && user.email) {
      await sendEmailChangeOldOtp(user.email, newOtpCode, user.username, newEmail);
      return NextResponse.json({
        success: true,
        step: "VERIFY_OLD",
        targetEmail: user.email,
        message: `Đã gửi lại mã OTP mới đến Email hiện tại (${user.email})!`,
      });
    }

    if (type === "NEW") {
      await sendEmailChangeNewOtp(newEmail, newOtpCode, user.username);
      return NextResponse.json({
        success: true,
        step: "VERIFY_NEW",
        targetEmail: newEmail,
        message: `Đã gửi lại mã OTP mới đến Email mới (${newEmail})!`,
      });
    }

    return NextResponse.json({ error: "Không xác định được bước gửi lại mã" }, { status: 400 });
  } catch (error: any) {
    console.error("Resend email OTP error:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi máy chủ khi gửi lại mã OTP" },
      { status: 500 }
    );
  }
}
