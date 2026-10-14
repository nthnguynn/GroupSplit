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

    const { newEmail } = await req.json();

    if (!newEmail || typeof newEmail !== "string") {
      return NextResponse.json(
        { error: "Vui lòng nhập địa chỉ Email mới hợp lệ" },
        { status: 400 }
      );
    }

    const cleanNewEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanNewEmail)) {
      return NextResponse.json(
        { error: "Địa chỉ Email không đúng định dạng" },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Kiểm tra xem email mới có bị trùng với tài khoản khác không
    const existingWithEmail = await prisma.user.findFirst({
      where: {
        email: cleanNewEmail,
        NOT: { id: userId },
      },
    });

    if (existingWithEmail) {
      return NextResponse.json(
        { error: "Địa chỉ Email này đã được liên kết với một tài khoản khác" },
        { status: 400 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        isEmailVerified: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Người dùng không tồn tại" }, { status: 404 });
    }

    if (currentUser.email?.toLowerCase() === cleanNewEmail && currentUser.isEmailVerified) {
      return NextResponse.json(
        { error: "Email mới không được trùng với Email hiện tại đang sử dụng" },
        { status: 400 }
      );
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

    // TRƯỜNG HỢP 1: Tài khoản chưa có email hoặc email chưa được xác thực
    // -> Xác thực 1 bước trực tiếp trên email mới
    if (!currentUser.email || !currentUser.isEmailVerified) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerificationToken: `NEW:${otpCode}:${cleanNewEmail}`,
          emailVerificationExpires: otpExpires,
        },
      });

      try {
        await sendEmailChangeNewOtp(cleanNewEmail, otpCode, currentUser.username);
      } catch (err: any) {
        console.error("Lỗi gửi email OTP mới:", err);
      }

      return NextResponse.json({
        success: true,
        step: "VERIFY_NEW",
        targetEmail: cleanNewEmail,
        newEmail: cleanNewEmail,
        message: `Mã OTP đã được gửi đến địa chỉ Email mới: ${cleanNewEmail}. Vui lòng kiểm tra hộp thư!`,
      });
    }

    // TRƯỜNG HỢP 2: Tài khoản ĐÃ CÓ email đã xác thực
    // -> Bước 1/2: Gửi OTP về Email cũ để xác thực yêu cầu đổi email
    await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: `OLD:${otpCode}:${cleanNewEmail}`,
        emailVerificationExpires: otpExpires,
      },
    });

    try {
      await sendEmailChangeOldOtp(currentUser.email, otpCode, currentUser.username, cleanNewEmail);
    } catch (err: any) {
      console.error("Lỗi gửi email OTP xác nhận email cũ:", err);
    }

    return NextResponse.json({
      success: true,
      step: "VERIFY_OLD",
      currentEmail: currentUser.email,
      targetEmail: currentUser.email,
      newEmail: cleanNewEmail,
      message: `Bước 1/2: Mã OTP xác nhận đã được gửi đến Email hiện tại (${currentUser.email}). Vui lòng nhập mã để tiếp tục.`,
    });
  } catch (error: any) {
    console.error("Email change request error:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi máy chủ khi yêu cầu đổi email" },
      { status: 500 }
    );
  }
}
