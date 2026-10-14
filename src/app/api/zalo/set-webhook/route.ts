import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getZaloWebhookInfo,
  setZaloWebhook,
  deleteZaloWebhook,
  ZALO_WEBHOOK_SECRET_SETTING,
} from "@/lib/zalo";

// 1. GET: Lấy thông tin Webhook hiện tại
export async function GET() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await getZaloWebhookInfo();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. POST: Đăng ký Webhook URL
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { webhookUrl, secretToken } = await req.json().catch(() => ({}));

    if (!webhookUrl || !webhookUrl.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập Webhook URL hợp lệ (phải có https://)" },
        { status: 400 }
      );
    }

    // secret_token bắt buộc từ 8 tới 256 ký tự theo tài liệu Zalo Bot API
    const secret =
      secretToken && secretToken.trim().length >= 8
        ? secretToken.trim()
        : process.env.ZALO_BOT_SECRET_TOKEN && process.env.ZALO_BOT_SECRET_TOKEN.trim().length >= 8
        ? process.env.ZALO_BOT_SECRET_TOKEN.trim()
        : null;

    if (!secret) {
      return NextResponse.json(
        { error: "Chưa cấu hình ZALO_BOT_SECRET_TOKEN (tối thiểu 8 ký tự) trong file .env" },
        { status: 400 }
      );
    }

    const data = await setZaloWebhook(webhookUrl.trim(), secret);

    // Lưu secret vừa đăng ký để webhook từ chối request không đến từ Zalo
    await prisma.systemSetting.upsert({
      where: { key: ZALO_WEBHOOK_SECRET_SETTING },
      update: { value: secret },
      create: { key: ZALO_WEBHOOK_SECRET_SETTING, value: secret },
    });

    return NextResponse.json({
      success: true,
      message: "Đã đăng ký Webhook thành công với Zalo Bot Platform (qua Axios)!",
      secretUsed: secret,
      data,
    });
  } catch (err: any) {
    console.error("Set Webhook error:", err);
    return NextResponse.json(
      { error: err.message || "Lỗi khi gọi API setWebhook" },
      { status: 500 }
    );
  }
}

// 3. DELETE: Hủy bỏ Webhook
export async function DELETE() {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await deleteZaloWebhook();

    return NextResponse.json({
      success: true,
      message: "Đã hủy bỏ Webhook thành công! (Có thể sử dụng lại getUpdates / Polling)",
      data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
