import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const limiter = await rateLimit(`verify-email:${ip}`, 10, 60 * 1000);
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Thao tác quá nhanh. Vui lòng thử lại sau ít phút!" },
        { status: 429 }
      );
    }

    const { email, otp } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ error: "Vui lòng nhập đầy đủ Email và mã OTP" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản với Email này" }, { status: 404 });
    }

    if (user.isEmailVerified) {
      return NextResponse.json({ message: "Tài khoản của bạn đã được xác thực trước đó!" });
    }

    if (!user.emailVerificationToken || user.emailVerificationToken !== otp.trim()) {
      return NextResponse.json({ error: "Mã OTP xác thực không chính xác" }, { status: 400 });
    }

    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      return NextResponse.json(
        { error: "Mã OTP đã hết hạn. Vui lòng bấm 'Gửi lại mã OTP'" },
        { status: 400 }
      );
    }

    // Cập nhật xác thực thành công
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Xác thực Email thành công! Bạn có thể đăng nhập ngay bây giờ.",
    });
  } catch (err: any) {
    console.error("Verify email error:", err);
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
