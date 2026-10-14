import axios from "axios";
import { prisma } from "@/lib/prisma";

/** Khóa SystemSetting lưu secret đã đăng ký với Zalo (set-webhook) để webhook xác thực request. */
export const ZALO_WEBHOOK_SECRET_SETTING = "ZALO_WEBHOOK_SECRET";


/**
 * Lấy URL gọi API của Zalo Bot Platform theo chuẩn
 */
export function getZaloApiUrl(functionName: string, token?: string): string {
  const botToken = token || process.env.ZALO_BOT_TOKEN || "";
  if (process.env.ZALO_BOT_API_URL) {
    return process.env.ZALO_BOT_API_URL;
  }
  return `https://bot-api.zaloplatforms.com/bot${botToken}/${functionName}`;
}

/**
 * Gửi tin nhắn Zalo trực tiếp đến một Zalo Chat ID bằng Axios
 */
export async function sendDirectZaloMessage(chatId: string, messageText: string) {
  const token = process.env.ZALO_BOT_TOKEN;
  if (!token || !chatId?.trim()) {
    console.error("[Zalo Axios] Missing token or chatId:", { token: !!token, chatId });
    return null;
  }

  try {
    const apiUrl = getZaloApiUrl("sendMessage", token);
    const response = await axios.post(
      apiUrl,
      {
        chat_id: String(chatId).trim(),
        text: messageText,
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10000,
      }
    );
    console.log("[Zalo Axios] Send Message Success:", response.data);
    return response.data;
  } catch (err: any) {
    console.error(
      "[Zalo Axios] Lỗi gửi tin nhắn Zalo:",
      err?.response?.data || err?.message || err
    );
    return null;
  }
}

/**
 * Lấy thông tin Webhook hiện tại từ Zalo Bot Platform
 */
export async function getZaloWebhookInfo() {
  const token = process.env.ZALO_BOT_TOKEN;
  if (!token) throw new Error("Chưa cấu hình ZALO_BOT_TOKEN trong file .env");

  const apiUrl = getZaloApiUrl("getWebhookInfo", token);
  const response = await axios.post(
    apiUrl,
    {},
    {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    }
  );
  return response.data;
}

/**
 * Đăng ký Webhook URL với Zalo Bot Platform
 */
export async function setZaloWebhook(webhookUrl: string, secretToken?: string) {
  const token = process.env.ZALO_BOT_TOKEN;
  if (!token) throw new Error("Chưa cấu hình ZALO_BOT_TOKEN trong file .env");

  const secret =
    secretToken && secretToken.trim().length >= 8
      ? secretToken.trim()
      : process.env.ZALO_BOT_SECRET_TOKEN && process.env.ZALO_BOT_SECRET_TOKEN.trim().length >= 8
      ? process.env.ZALO_BOT_SECRET_TOKEN.trim()
      : null;

  if (!secret) {
    throw new Error(
      "Chưa cấu hình ZALO_BOT_SECRET_TOKEN (tối thiểu 8 ký tự) trong file .env"
    );
  }

  const apiUrl = getZaloApiUrl("setWebhook", token);
  const response = await axios.post(
    apiUrl,
    {
      url: webhookUrl.trim(),
      secret_token: secret,
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    }
  );
  return response.data;
}

/**
 * Hủy đăng ký Webhook với Zalo Bot Platform
 */
export async function deleteZaloWebhook() {
  const token = process.env.ZALO_BOT_TOKEN;
  if (!token) throw new Error("Chưa cấu hình ZALO_BOT_TOKEN trong file .env");

  const apiUrl = getZaloApiUrl("deleteWebhook", token);
  const response = await axios.post(
    apiUrl,
    {},
    {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    }
  );
  return response.data;
}

/**
 * Hàm gửi tin nhắn Zalo thử nghiệm
 */
export async function sendDirectZaloTest(chatId: string, groupName?: string) {
  const targetName = groupName ? `cho nhóm "${groupName}"` : "";
  const testMessage = `🟢 [GroupSplit] Đây là tin nhắn Zalo thử nghiệm ${targetName}!
  
Zalo Chat ID (${chatId}) đã được kết nối thành công! 🎉`;
  return sendDirectZaloMessage(chatId, testMessage);
}

/**
 * Gửi thông báo Zalo cá nhân đến 1 người dùng dựa vào User ID
 */
export async function sendUserZaloNotification(
  userId: string,
  messageText: string
) {
  if (!userId) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { zaloChatId: true },
    });

    if (!user?.zaloChatId?.trim()) return;

    await sendDirectZaloMessage(user.zaloChatId, messageText);
  } catch (err) {
    console.error("[Zalo Axios] Lỗi khi lấy Zalo Chat ID người dùng:", err);
  }
}

/**
 * Gửi thông báo Zalo cá nhân đến nhiều người dùng (Array of User IDs)
 */
export async function sendMultipleUsersZaloNotification(
  userIds: string[],
  messageText: string
) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { zaloChatId: true },
    });

    const validChatIds = users
      .map((u) => u.zaloChatId?.trim())
      .filter((id): id is string => !!id);

    for (const chatId of validChatIds) {
      await sendDirectZaloMessage(chatId, messageText);
    }
  } catch (err) {
    console.error("[Zalo Axios] Lỗi khi gửi thông báo nhiều người dùng:", err);
  }
}

/**
 * Gửi mã OTP xác nhận Đổi Mật Khẩu qua Zalo Bot cá nhân
 */
export async function sendPasswordChangeZaloOtp(
  chatId: string,
  otpCode: string,
  username: string
) {
  const messageText = `🔐 [GroupSplit] Mã OTP Xác nhận Đổi Mật Khẩu

Xin chào @${username},
Bạn vừa yêu cầu thay đổi mật khẩu cho tài khoản GroupSplit của mình.

Mã OTP xác nhận của bạn là: 👉 ${otpCode} 👈
(Mã có hiệu lực trong vòng 15 phút)

⚠️ Nếu không phải bạn thực hiện yêu cầu này, vui lòng bỏ qua tin nhắn này hoặc kiểm tra lại bảo mật tài khoản.`;

  return sendDirectZaloMessage(chatId, messageText);
}

