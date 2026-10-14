import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { verifyCaptcha } from "@/lib/captcha";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const limiter = await rateLimit(`login-check:${ip}`, 15, 60 * 1000);
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Thao tác quá nhanh. Vui lòng thử lại sau 1 phút!" },
        { status: 429 }
      );
    }

    const { username, password, captchaId, captchaAnswer, captchaHash } =
      await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Vui lòng nhập tên đăng nhập và mật khẩu" },
        { status: 400 }
      );
    }

    if (!verifyCaptcha(captchaId, captchaAnswer, captchaHash)) {
      return NextResponse.json(
        { error: "Kết quả CAPTCHA không chính xác" },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim();
    const user = await prisma.user.findUnique({
      where: { username: cleanUsername },
    });

    if (!user) {
      return NextResponse.json(
        { code: "INVALID_CREDENTIALS", error: "Tên đăng nhập hoặc mật khẩu không chính xác" },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { code: "INVALID_CREDENTIALS", error: "Tên đăng nhập hoặc mật khẩu không chính xác" },
        { status: 400 }
      );
    }

    // Quyền Admin chỉ dựa vào cột role trong DB (không hardcode username)
    const userRole = user.role;
    const isVerified = user.isEmailVerified;

    // Kiểm tra tài khoản chưa xác thực Email (Admin được miễn)
    if (userRole !== "ADMIN" && !isVerified) {
      return NextResponse.json(
        {
          code: "UNVERIFIED_EMAIL",
          error: "Tài khoản của bạn chưa được kích hoạt xác thực Email!",
          email: user.email,
          username: user.username,
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Login check error:", err);
    return NextResponse.json(
      { error: err.message || "Lỗi hệ thống khi kiểm tra đăng nhập" },
      { status: 500 }
    );
  }
}
