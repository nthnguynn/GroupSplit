import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { sendVerificationEmail } from "@/lib/email";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id!;

  try {
    const formData = await req.formData();
    const displayName = formData.get("displayName") as string;
    const emailRaw = formData.get("email") as string | null;
    const bankName = formData.get("bankName") as string;
    const accountNumber = formData.get("accountNumber") as string;
    const accountName = formData.get("accountName") as string;
    const sepayWebhookSecret = formData.get("sepayWebhookSecret") as string | null;
    const avatarFile = formData.get("avatar") as File | null;

    if (!displayName) {
      return NextResponse.json(
        { error: "Tên hiển thị là bắt buộc" },
        { status: 400 }
      );
    }

    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: "Thông tin ngân hàng là bắt buộc" },
        { status: 400 }
      );
    }

    // Lấy thông tin user hiện tại
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, isEmailVerified: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Người dùng không tồn tại" }, { status: 404 });
    }

    let emailData: {
      email?: string | null;
      isEmailVerified?: boolean;
      emailVerificationToken?: string | null;
      emailVerificationExpires?: Date | null;
    } = {};

    let emailChanged = false;
    let otpGenerated = false;

    if (emailRaw !== null && emailRaw !== undefined) {
      const cleanEmail = emailRaw.trim().toLowerCase();

      if (cleanEmail === "") {
        // Người dùng xóa email
        if (currentUser.email) {
          emailData = {
            email: null,
            isEmailVerified: false,
            emailVerificationToken: null,
            emailVerificationExpires: null,
          };
        }
      } else {
        // Validate định dạng email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          return NextResponse.json(
            { error: "Địa chỉ Email không đúng định dạng" },
            { status: 400 }
          );
        }

        // Kiểm tra xem email có bị trùng với tài khoản khác không
        const existingWithEmail = await prisma.user.findFirst({
          where: {
            email: cleanEmail,
            NOT: { id: userId },
          },
        });

        if (existingWithEmail) {
          return NextResponse.json(
            { error: "Địa chỉ Email này đã được liên kết với một tài khoản khác" },
            { status: 400 }
          );
        }

        // Nếu email mới khác với email cũ
        if (currentUser.email?.toLowerCase() !== cleanEmail) {
          emailChanged = true;
          const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
          const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút

          emailData = {
            email: cleanEmail,
            isEmailVerified: false,
            emailVerificationToken: otpCode,
            emailVerificationExpires: otpExpires,
          };

          // Gửi mã OTP xác thực email
          try {
            await sendVerificationEmail(cleanEmail, otpCode, currentUser.username);
            otpGenerated = true;
          } catch (mailErr) {
            console.error("Lỗi gửi email xác thực:", mailErr);
          }
        }
      }
    }

    let avatarUrl: string | undefined = undefined;

    // Nếu người dùng tải lên file ảnh đại diện mới
    if (avatarFile && avatarFile.size > 0 && avatarFile.name) {
      // Thư mục lưu trữ static của Next.js (phục vụ cho việc bind mount)
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });

      const fileExt = path.extname(avatarFile.name) || ".jpg";
      const fileName = `${userId}-${Date.now()}${fileExt}`;
      const filePath = path.join(uploadDir, fileName);

      const buffer = Buffer.from(await avatarFile.arrayBuffer());
      await writeFile(filePath, buffer);

      avatarUrl = `/uploads/${fileName}`;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        displayName,
        ...(avatarUrl !== undefined ? { avatar: avatarUrl } : {}),
        ...emailData,
        bankName,
        accountNumber,
        accountName,
        sepayWebhookSecret: sepayWebhookSecret || null,
      },
    });

    return NextResponse.json({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      emailChanged,
      otpGenerated,
      avatar: user.avatar,
      bankName: user.bankName,
      accountNumber: user.accountNumber,
      accountName: user.accountName,
    });
  } catch (error) {
    console.error("Save settings error:", error);
    return NextResponse.json({ error: "Lỗi server" }, { status: 500 });
  }
}
