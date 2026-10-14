import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
        passwordResetToken: true,
        passwordResetExpires: true,
      },
    });

    if (!user || !user.passwordResetToken) {
      return NextResponse.json(
        { error: "Không tìm thấy yêu cầu đổi mật khẩu hoặc phiên đã kết thúc" },
        { status: 400 }
      );
    }

    if (user.passwordResetExpires && new Date() > user.passwordResetExpires) {
      return NextResponse.json(
        { error: "Mã OTP đã hết hạn (quá 15 phút). Vui lòng thực hiện lại yêu cầu đổi mật khẩu." },
        { status: 400 }
      );
    }

    const parts = user.passwordResetToken.split(":");
    if (parts.length < 3 || parts[0] !== "CHANGE_PWD") {
      return NextResponse.json(
        { error: "Dữ liệu xác thực không hợp lệ. Vui lòng thử lại từ đầu." },
        { status: 400 }
      );
    }

    const [, expectedOtp, newPasswordHash] = parts;

    if (otp.trim() !== expectedOtp) {
      return NextResponse.json(
        { error: "Mã OTP không chính xác. Vui lòng kiểm tra lại!" },
        { status: 400 }
      );
    }

    // Cập nhật mật khẩu mới thành công
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Đổi mật khẩu thành công! Bạn có thể sử dụng mật khẩu mới để đăng nhập.",
    });
  } catch (error: any) {
    console.error("Change password verify OTP error:", error);
    return NextResponse.json(
      { error: error?.message || "Lỗi máy chủ khi xác thực OTP đổi mật khẩu" },
      { status: 500 }
    );
  }
}
