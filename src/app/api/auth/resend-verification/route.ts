import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const limiter = await rateLimit(`resend-otp:${ip}`, 5, 60 * 1000);
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Thao tác quá nhanh. Vui lòng thử lại sau ít phút!" },
        { status: 429 }
      );
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Vui lòng nhập địa chỉ Email" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản với Email này" }, { status: 404 });
    }

    if (user.isEmailVerified) {
      return NextResponse.json({ message: "Tài khoản của bạn đã được xác thực thành công rồi!" });
    }

    // Sinh mã OTP 6 số mới
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: otpCode,
        emailVerificationExpires: otpExpires,
      },
    });

    await sendVerificationEmail(user.email!, otpCode, user.username);

    return NextResponse.json({
      success: true,
      message: "Đã gửi lại mã OTP xác thực mới đến Email của bạn!",
    });
  } catch (err: any) {
    console.error("Resend verification error:", err);
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
