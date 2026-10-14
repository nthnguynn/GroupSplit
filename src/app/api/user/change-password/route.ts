import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendPasswordChangeOtpEmail } from "@/lib/email";
import { sendPasswordChangeZaloOtp } from "@/lib/zalo";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword, confirmPassword, channel } = await req.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Vui lòng điền đầy đủ tất cả các trường mật khẩu" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu mới phải có ít nhất 6 ký tự" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Xác nhận mật khẩu mới không trùng khớp" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        email: true,
        isEmailVerified: true,
        zaloChatId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Người dùng không tồn tại" },
        { status: 404 }
      );
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Mật khẩu hiện tại không chính xác" },
        { status: 400 }
      );
    }

    const hasEmail = Boolean(user.email && user.isEmailVerified);
    const hasZalo = Boolean(user.zaloChatId && user.zaloChatId.trim());

    // YÊU CẦU BẮT BUỘC: Tài khoản phải có ít nhất 1 kênh bảo mật (Email đã xác thực hoặc Zalo Bot)
    if (!hasEmail && !hasZalo) {
      return NextResponse.json(
        {
          error: "Tài khoản của bạn chưa thiết lập kênh bảo mật. Vui lòng liên kết Địa chỉ Email (đã xác thực) hoặc Zalo Bot cá nhân ở phần trên trước khi đổi mật khẩu!",
          requireSecurityChannel: true,
        },
        { status: 400 }
      );
    }

    // Xác định kênh gửi OTP
    let chosenChannel: "email" | "zalo" = "email";
    if (channel === "zalo" && hasZalo) {
      chosenChannel = "zalo";
    } else if (channel === "email" && hasEmail) {
      chosenChannel = "email";
    } else if (hasEmail) {
      chosenChannel = "email";
    } else if (hasZalo) {
      chosenChannel = "zalo";
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    // Lưu token đổi mật khẩu dạng CHANGE_PWD:<otp>:<hash>:<channel>
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: `CHANGE_PWD:${otpCode}:${newPasswordHash}:${chosenChannel}`,
        passwordResetExpires: otpExpires,
      },
    });

    // Gửi OTP qua kênh đã chọn
    if (chosenChannel === "email" && user.email) {
      try {
        await sendPasswordChangeOtpEmail(user.email, otpCode, user.username);
      } catch (err) {
        console.error("Lỗi gửi OTP đổi mật khẩu qua Email:", err);
      }
    } else if (chosenChannel === "zalo" && user.zaloChatId) {
      try {
        await sendPasswordChangeZaloOtp(user.zaloChatId, otpCode, user.username);
      } catch (err) {
        console.error("Lỗi gửi OTP đổi mật khẩu qua Zalo:", err);
      }
    }

    const targetDesc = chosenChannel === "email" ? `Email (${user.email})` : `Zalo Bot (Chat ID: ${user.zaloChatId})`;

    return NextResponse.json({
      success: true,
      requireOtp: true,
      channel: chosenChannel,
      hasEmail,
      hasZalo,
      targetDesc,
      message: `Mã OTP xác nhận đổi mật khẩu đã được gửi đến ${targetDesc}. Vui lòng nhập mã để hoàn tất!`,
    });
  } catch (error: any) {
    console.error("Change password request error:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi máy chủ khi đổi mật khẩu" },
      { status: 500 }
    );
  }
}
