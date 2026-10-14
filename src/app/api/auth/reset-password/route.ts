import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { verifyCaptcha } from "@/lib/captcha";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const limiter = await rateLimit(`reset-password:${ip}`, 5, 60 * 1000);
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Thao tác quá nhanh. Vui lòng thử lại sau 1 phút!" },
        { status: 429 }
      );
    }

    const { emailOrUsername, otp, newPassword, captchaId, captchaAnswer, captchaHash } =
      await req.json();

    if (!emailOrUsername || !otp || !newPassword) {
      return NextResponse.json({ error: "Vui lòng nhập đầy đủ thông tin" }, { status: 400 });
    }

    if (!verifyCaptcha(captchaId, captchaAnswer, captchaHash)) {
      return NextResponse.json({ error: "Kết quả CAPTCHA không chính xác" }, { status: 400 });
    }

    if (newPassword.length < 8 || !/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm cả chữ cái và chữ số" },
        { status: 400 }
      );
    }

    const query = emailOrUsername.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: query }, { email: query }],
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Tài khoản không tồn tại" }, { status: 404 });
    }

    if (!user.passwordResetToken || user.passwordResetToken !== otp.trim()) {
      return NextResponse.json({ error: "Mã OTP khôi phục mật khẩu không chính xác" }, { status: 400 });
    }

    if (user.passwordResetExpires && new Date() > user.passwordResetExpires) {
      return NextResponse.json({ error: "Mã OTP khôi phục đã hết hạn" }, { status: 400 });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.",
    });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
