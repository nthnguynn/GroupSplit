import { Resend } from "resend";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface EmailSystemConfig {
  resendApiKey: string;
  fromEmail: string;
  smtp: SmtpConfig | null;
}

/**
 * Lấy cấu hình Email từ bảng SystemSetting trong DB hoặc biến môi trường .env
 */
export async function getEmailConfig(): Promise<EmailSystemConfig> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            "RESEND_API",
            "RESEND_API_KEY",
            "EMAIL_FROM",
            "RESEND_FROM",
            "SMTP_HOST",
            "SMTP_PORT",
            "SMTP_USER",
            "SMTP_PASS",
            "SMTP_FROM",
            "SMTP_SECURE",
          ],
        },
      },
    });

    const map = new Map<string, string>(
      settings.map((s: { key: string; value: string }) => [s.key, s.value])
    );

    // Resend configuration
    const resendApiKey =
      map.get("RESEND_API") ||
      map.get("RESEND_API_KEY") ||
      process.env.RESEND_API ||
      process.env.RESEND_API_KEY ||
      "";

    let fromEmail =
      map.get("EMAIL_FROM") ||
      map.get("RESEND_FROM") ||
      process.env.EMAIL_FROM ||
      process.env.RESEND_FROM ||
      "GroupSplit <support@qy286.me>";

    // Format sender name if user only provided raw email
    if (fromEmail && !fromEmail.includes("<") && fromEmail.includes("@")) {
      fromEmail = `GroupSplit <${fromEmail.trim()}>`;
    }

    // SMTP configuration fallback
    const host = map.get("SMTP_HOST") || process.env.SMTP_HOST || "";
    const port = Number(map.get("SMTP_PORT") || process.env.SMTP_PORT || 587);
    const user = map.get("SMTP_USER") || process.env.SMTP_USER || "";
    const pass = map.get("SMTP_PASS") || process.env.SMTP_PASS || "";
    const smtpFrom =
      map.get("SMTP_FROM") ||
      process.env.SMTP_FROM ||
      fromEmail ||
      "no-reply@groupsplit.local";
    const secure =
      map.get("SMTP_SECURE") === "true" || process.env.SMTP_SECURE === "true";

    const smtp: SmtpConfig | null =
      host && user ? { host, port, secure, user, pass, from: smtpFrom } : null;

    return { resendApiKey, fromEmail, smtp };
  } catch (err) {
    console.error("Error reading Email config:", err);
    const resendApiKey = process.env.RESEND_API || process.env.RESEND_API_KEY || "";
    const fromEmail = process.env.EMAIL_FROM || process.env.RESEND_FROM || "GroupSplit <support@qy286.me>";
    return { resendApiKey, fromEmail, smtp: null };
  }
}

/**
 * Gửi email chính thức qua Resend SDK hoặc Fallback qua SMTP
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const config = await getEmailConfig();

  // 1. Ưu tiên gửi qua Resend nếu có API Key
  if (config.resendApiKey) {
    try {
      const resend = new Resend(config.resendApiKey);

      const { data, error } = await resend.emails.send({
        from: config.fromEmail,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ""),
      });

      if (error) {
        console.error("[Resend Error]:", error);
        throw new Error(error.message || "Không thể gửi email qua Resend");
      }

      console.log("[Resend Service] Email sent successfully:", data?.id);
      return { success: true, messageId: data?.id, mode: "resend" };
    } catch (err: any) {
      console.error("[Resend Exception]:", err);
      // Nếu Resend lỗi nhưng có SMTP dự phòng, thử gửi qua SMTP
      if (!config.smtp) {
        throw new Error(err.message || "Không thể gửi email qua Resend");
      }
      console.warn("[Email Service] Resend thất bại, chuyển sang gửi qua SMTP...");
    }
  }

  // 2. Fallback qua SMTP nếu được cấu hình
  if (config.smtp) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });

      const info = await transporter.sendMail({
        from: config.smtp.from,
        to,
        subject,
        text: text || html.replace(/<[^>]*>?/gm, ""),
        html,
      });

      console.log("[SMTP Service] Email sent successfully:", info.messageId);
      return { success: true, messageId: info.messageId, mode: "smtp" };
    } catch (err: any) {
      console.error("[SMTP Service Error]:", err);
      throw new Error(err.message || "Không thể gửi email qua máy chủ SMTP");
    }
  }

  // 3. Mô phỏng nếu chưa cấu hình Resend lẫn SMTP
  console.log(
    `[Email Service Notice] Chưa cấu hình Resend API hoặc SMTP. Chi tiết Email gửi tới [${to}]:`
  );
  console.log(`From: ${config.fromEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${text || html}`);
  return { success: true, mode: "simulated" };
}

/**
 * Gửi email chứa mã OTP xác thực Email khi Đăng ký
 */
export async function sendVerificationEmail(
  toEmail: string,
  otpCode: string,
  username: string
) {
  const subject = `🟢 [GroupSplit] Mã OTP xác thực tài khoản Email`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #2563eb; margin: 0; font-size: 22px;">GroupSplit - Quản lý Chi tiêu</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Xác thực địa chỉ Email tài khoản</p>
      </div>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Xin chào <strong>@${username}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Vui lòng sử dụng mã OTP dưới đây để hoàn tất việc xác thực địa chỉ email của bạn:</p>
      <div style="text-align: center; margin: 28px 0;">
        <span style="font-size: 34px; font-weight: 800; font-family: Consolas, Monaco, monospace; letter-spacing: 6px; color: #2563eb; background: #eff6ff; padding: 12px 28px; border-radius: 12px; border: 1px solid #bfdbfe; display: inline-block;">
          ${otpCode}
        </span>
      </div>
      <p style="color: #64748b; font-size: 12px; line-height: 1.5; border-top: 1px dashed #e2e8f0; padding-top: 16px; margin-top: 24px;">
        ⏱️ Mã OTP có hiệu lực trong <strong>15 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai. Nếu bạn không yêu cầu mã này, bạn có thể yên tâm bỏ qua email.
      </p>
    </div>
  `;
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Gửi email OTP Bước 1/2: Xác nhận từ Email cũ trước khi đổi sang Email mới
 */
export async function sendEmailChangeOldOtp(
  oldEmail: string,
  otpCode: string,
  username: string,
  newEmail: string
) {
  const subject = `🛡️ [GroupSplit] Mã OTP xác nhận yêu cầu thay đổi Email`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #fed7aa; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #ea580c; margin: 0; font-size: 22px;">GroupSplit - Bảo mật Tài khoản</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Bước 1/2: Xác nhận thay đổi Email hiện tại</p>
      </div>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Xin chào <strong>@${username}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">
        Tài khoản của bạn vừa yêu cầu thay đổi địa chỉ email liên kết sang email mới: <strong>${newEmail}</strong>.
      </p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Vui lòng nhập mã OTP dưới đây tại trang cài đặt để xác nhận quyền sở hữu:</p>
      <div style="text-align: center; margin: 28px 0;">
        <span style="font-size: 34px; font-weight: 800; font-family: Consolas, Monaco, monospace; letter-spacing: 6px; color: #ea580c; background: #fff7ed; padding: 12px 28px; border-radius: 12px; border: 1px solid #fed7aa; display: inline-block;">
          ${otpCode}
        </span>
      </div>
      <p style="color: #64748b; font-size: 12px; line-height: 1.5; border-top: 1px dashed #fed7aa; padding-top: 16px; margin-top: 24px;">
        ⏱️ Mã OTP có hiệu lực trong <strong>15 phút</strong>. Nếu bạn KHÔNG thực hiện yêu cầu này, hãy đổi mật khẩu tài khoản ngay để bảo vệ thông tin.
      </p>
    </div>
  `;
  return sendEmail({ to: oldEmail, subject, html });
}

/**
 * Gửi email OTP Bước 2/2: Kích hoạt địa chỉ Email mới
 */
export async function sendEmailChangeNewOtp(
  newEmail: string,
  otpCode: string,
  username: string
) {
  const subject = `🟢 [GroupSplit] Mã OTP kích hoạt địa chỉ Email mới`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #bbf7d0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #16a34a; margin: 0; font-size: 22px;">GroupSplit - Kích hoạt Email</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Bước 2/2: Kích hoạt địa chỉ Email mới</p>
      </div>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Xin chào <strong>@${username}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Vui lòng nhập mã OTP dưới đây để hoàn tất việc liên kết địa chỉ email này với tài khoản GroupSplit của bạn:</p>
      <div style="text-align: center; margin: 28px 0;">
        <span style="font-size: 34px; font-weight: 800; font-family: Consolas, Monaco, monospace; letter-spacing: 6px; color: #16a34a; background: #f0fdf4; padding: 12px 28px; border-radius: 12px; border: 1px solid #bbf7d0; display: inline-block;">
          ${otpCode}
        </span>
      </div>
      <p style="color: #64748b; font-size: 12px; line-height: 1.5; border-top: 1px dashed #bbf7d0; padding-top: 16px; margin-top: 24px;">
        ⏱️ Mã OTP có hiệu lực trong <strong>15 phút</strong>.
      </p>
    </div>
  `;
  return sendEmail({ to: newEmail, subject, html });
}

/**
 * Gửi email OTP xác nhận Đổi Mật Khẩu
 */
export async function sendPasswordChangeOtpEmail(
  toEmail: string,
  otpCode: string,
  username: string
) {
  const subject = `🔐 [GroupSplit] Mã OTP xác nhận đổi mật khẩu`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #2563eb; margin: 0; font-size: 22px;">GroupSplit - Bảo mật Tài khoản</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Xác nhận yêu cầu thay đổi mật khẩu</p>
      </div>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Xin chào <strong>@${username}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Bạn vừa thực hiện yêu cầu đổi mật khẩu cho tài khoản GroupSplit của mình. Vui lòng nhập mã OTP dưới đây để hoàn tất:</p>
      <div style="text-align: center; margin: 28px 0;">
        <span style="font-size: 34px; font-weight: 800; font-family: Consolas, Monaco, monospace; letter-spacing: 6px; color: #2563eb; background: #eff6ff; padding: 12px 28px; border-radius: 12px; border: 1px solid #bfdbfe; display: inline-block;">
          ${otpCode}
        </span>
      </div>
      <p style="color: #64748b; font-size: 12px; line-height: 1.5; border-top: 1px dashed #e2e8f0; padding-top: 16px; margin-top: 24px;">
        ⏱️ Mã OTP có hiệu lực trong <strong>15 phút</strong>. Nếu không phải bạn thực hiện yêu cầu này, vui lòng bỏ qua email này ngay lập tức.
      </p>
    </div>
  `;
  return sendEmail({ to: toEmail, subject, html });
}

/**
 * Gửi email chứa mã OTP Khôi phục Mật khẩu (Quên mật khẩu)
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  otpCode: string,
  username: string
) {
  const subject = `🔑 [GroupSplit] Mã OTP khôi phục mật khẩu`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #dc2626; margin: 0; font-size: 22px;">GroupSplit - Khôi phục Mật khẩu</h2>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Yêu cầu đặt lại mật khẩu đăng nhập</p>
      </div>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Xin chào <strong>@${username}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">Bạn vừa yêu cầu cấp lại mật khẩu cho tài khoản GroupSplit của mình. Vui lòng nhập mã OTP dưới đây để tạo mật khẩu mới:</p>
      <div style="text-align: center; margin: 28px 0;">
        <span style="font-size: 34px; font-weight: 800; font-family: Consolas, Monaco, monospace; letter-spacing: 6px; color: #dc2626; background: #fef2f2; padding: 12px 28px; border-radius: 12px; border: 1px solid #fecaca; display: inline-block;">
          ${otpCode}
        </span>
      </div>
      <p style="color: #64748b; font-size: 12px; line-height: 1.5; border-top: 1px dashed #fee2e2; padding-top: 16px; margin-top: 24px;">
        ⏱️ Mã OTP có hiệu lực trong <strong>15 phút</strong>. Nếu bạn không thực hiện yêu cầu này, hãy đổi mật khẩu hoặc liên hệ quản trị viên ngay.
      </p>
    </div>
  `;
  return sendEmail({ to: toEmail, subject, html });
}
