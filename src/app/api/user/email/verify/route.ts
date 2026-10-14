import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailChangeNewOtp } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { otp } = await req.json();

    if (!otp || typeof otp !== "string" || otp.trim().length !== 6) {
      return NextResponse.json(
        { error: "Vui lòng nhập đúng mã OTP gồm 6 chữ số" },
        { status: 400 }
      );
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
        emailVerificationExpires: true,
      },
    });

    if (!user || !user.emailVerificationToken) {
      return NextResponse.json(
        { error: "Không tìm thấy yêu cầu xác thực OTP hoặc phiên đã kết thúc" },
        { status: 400 }
      );
    }

    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      return NextResponse.json(
        { error: "Mã OTP đã hết hạn (quá 15 phút). Vui lòng bấm 'Gửi lại mã OTP'" },
        { status: 400 }
      );
    }

    const parts = user.emailVerificationToken.split(":");
    if (parts.length < 3) {
      return NextResponse.json(
        { error: "Dữ liệu phiên xác thực không hợp lệ. Vui lòng yêu cầu mã mới." },
        { status: 400 }
      );
    }

    const [type, expectedOtp, newEmail] = parts;

    if (otp.trim() !== expectedOtp) {
      return NextResponse.json(
        { error: "Mã OTP không chính xác. Vui lòng kiểm tra lại kỹ email." },
        { status: 400 }
      );
    }

    // XỬ LÝ BƯỚC 1: XÁC THỰC EMAIL CŨ THÀNH CÔNG -> CHUYỂN SANG BƯỚC 2 (GỬI OTP EMAIL MỚI)
    if (type === "OLD") {
      const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const newOtpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

      await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerificationToken: `NEW:${newOtpCode}:${newEmail}`,
          emailVerificationExpires: newOtpExpires,
        },
      });

      try {
        await sendEmailChangeNewOtp(newEmail, newOtpCode, user.username);
      } catch (err: any) {
        console.error("Lỗi gửi mã OTP kích hoạt email mới:", err);
      }

      return NextResponse.json({
        success: true,
        step: "VERIFY_NEW",
        targetEmail: newEmail,
        newEmail,
        message: `Xác nhận Email cũ thành công! Bước 2/2: Mã OTP kích hoạt đã được gửi tới Email mới (${newEmail}).`,
      });
    }

    // XỬ LÝ BƯỚC 2 (HOẶC XÁC THỰC LẦN ĐẦU): XÁC THỰC EMAIL MỚI THÀNH CÔNG -> CẬP NHẬT EMAIL VÀO DB
    if (type === "NEW") {
      // Đảm bảo email chưa bị tài khoản khác lấy trong lúc đang xác thực
      const doubleCheck = await prisma.user.findFirst({
        where: {
          email: newEmail,
          NOT: { id: userId },
        },
      });

      if (doubleCheck) {
        return NextResponse.json(
          { error: "Địa chỉ Email này vừa được liên kết với một tài khoản khác" },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          email: newEmail,
          isEmailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpires: null,
        },
      });

      return NextResponse.json({
        success: true,
        completed: true,
        email: newEmail,
        isEmailVerified: true,
        message: `Chúc mừng! Bạn đã cập nhật và xác thực thành công địa chỉ Email: ${newEmail}`,
      });
    }

    return NextResponse.json(
      { error: "Loại xác thực không xác định" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Email verify error:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi máy chủ khi xác thực OTP email" },
      { status: 500 }
    );
  }
}
