import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendEmail, getEmailConfig } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (user.username !== "qy286" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Quyền truy cập bị từ chối" }, { status: 403 });
  }

  try {
    const { toEmail } = await req.json();

    if (!toEmail) {
      return NextResponse.json({ error: "Vui lòng nhập Email người nhận thử nghiệm" }, { status: 400 });
    }

    const config = await getEmailConfig();
    const serviceType = config.resendApiKey ? "Resend API" : config.smtp ? "SMTP Server" : "Mô phỏng (Chưa cấu hình)";

    const result = await sendEmail({
      to: toEmail.trim(),
      subject: "🧪 [GroupSplit Admin] Email kiểm tra cấu hình gửi mail",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 520px; margin: 0 auto; background: #ffffff;">
          <h2 style="color: #2563eb; margin: 0 0 12px;">GroupSplit Email Service Test</h2>
          <p style="color: #334155; font-size: 14px;">Chúc mừng! Hệ thống gửi email của bạn qua <strong>${serviceType}</strong> đang hoạt động hoàn hảo.</p>
          <div style="background: #f8fafc; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #475569; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Sender (From):</strong> ${config.fromEmail}</p>
            <p style="margin: 4px 0;"><strong>Dịch vụ:</strong> ${serviceType}</p>
            <p style="margin: 4px 0;"><strong>Thời gian gửi:</strong> ${new Date().toLocaleString("vi-VN")}</p>
          </div>
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">GroupSplit - Nền tảng chia tiền và quản lý tài chính nhóm</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: `Đã gửi thành công Email thử nghiệm qua ${serviceType} đến ${toEmail}!`,
      result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
