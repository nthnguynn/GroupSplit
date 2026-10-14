import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { verifyCaptcha } from "@/lib/captcha";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const limiter = await rateLimit(`forgot-password:${ip}`, 5, 60 * 1000);
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Thao tác quá nhanh. Vui lòng thử lại sau 1 phút!" },
        { status: 429 }
      );
    }

    const { emailOrUsername, captchaId, captchaAnswer, captchaHash } = await req.json();

    if (!emailOrUsername) {
      return NextResponse.json({ error: "Vui lòng nhập Username hoặc Email" }, { status: 400 });
    }

    if (!verifyCaptcha(captchaId, captchaAnswer, captchaHash)) {
      return NextResponse.json({ error: "Kết quả CAPTCHA không chính xác" }, { status: 400 });
    }

    const query = emailOrUsername.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: query }, { email: query }],
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản tương ứng trên hệ thống" },
        { status: 404 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "Tài khoản này chưa đăng ký địa chỉ Email để khôi phục mật khẩu. Vui lòng liên hệ Quản trị viên." },
        { status: 400 }
      );
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: otpCode,
        passwordResetExpires: otpExpires,
      },
    });

    await sendPasswordResetEmail(user.email, otpCode, user.username);

    return NextResponse.json({
      success: true,
      email: user.email,
      username: user.username,
      message: "Đã gửi mã OTP khôi phục mật khẩu đến Email của bạn!",
    });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
