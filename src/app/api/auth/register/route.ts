import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import crypto from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { verifyCaptcha } from "@/lib/captcha";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting chống DDoS / Brute Force
    const ip = getClientIp(req.headers);
    const limiter = await rateLimit(`register:${ip}`, 10, 60 * 1000);
    if (!limiter.success) {
      return NextResponse.json(
        { error: "Thao tác quá nhanh. Vui lòng thử lại sau ít phút!" },
        { status: 429 }
      );
    }

    const { username, displayName, email, password, captchaId, captchaAnswer, captchaHash } =
      await req.json();

    if (!username || !displayName || !password || !email) {
      return NextResponse.json({ error: "Vui lòng nhập đầy đủ thông tin" }, { status: 400 });
    }

    // 2. Xác thực CAPTCHA
    if (!verifyCaptcha(captchaId, captchaAnswer, captchaHash)) {
      return NextResponse.json({ error: "Kết quả CAPTCHA không chính xác" }, { status: 400 });
    }

    // 3. Kiểm tra định dạng Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Định dạng Email không hợp lệ" }, { status: 400 });
    }

    // 4. Kiểm tra độ mạnh mật khẩu (tối thiểu 8 ký tự, có chữ & số)
    if (password.length < 8 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
      return NextResponse.json(
        { error: "Mật khẩu phải có ít nhất 8 ký tự, bao gồm cả chữ cái và chữ số" },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // 5. Kiểm tra trùng lặp username & email
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: cleanUsername }, { email: cleanEmail }],
      },
    });

    if (existingUser) {
      if (existingUser.username === cleanUsername) {
        return NextResponse.json({ error: "Tên đăng nhập đã được sử dụng" }, { status: 409 });
      }
      return NextResponse.json({ error: "Địa chỉ Email đã được sử dụng" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    // Sinh mã OTP 6 số cho xác thực email
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    // Mọi tài khoản mới đều là USER và phải xác thực email. Quyền Admin chỉ cấp
    // trong DB hoặc trang Admin — không tự cấp theo username (ai đăng ký trước tên đó sẽ chiếm quyền).
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        displayName: displayName.trim(),
        email: cleanEmail,
        passwordHash,
        role: "USER",
        isEmailVerified: false,
        emailVerificationToken: otpCode,
        emailVerificationExpires: otpExpires,
      },
    });

    // Gửi Email xác thực
    try {
      await sendVerificationEmail(cleanEmail, otpCode, cleanUsername);
    } catch (mailErr) {
      console.error("Gửi email thất bại nhưng đã tạo user:", mailErr);
    }

    return NextResponse.json(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        requiresVerification: true,
        message: "Đăng ký thành công! Vui lòng kiểm tra Email để nhập mã xác thực OTP.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json({ error: error.message || "Lỗi server" }, { status: 500 });
  }
}
