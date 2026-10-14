import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = process.env.ZALO_BOT_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Chưa cấu hình ZALO_BOT_TOKEN trong file .env" },
        { status: 400 }
      );
    }

    const apiUrl = `https://bot-api.zaloplatforms.com/bot${token}/getUpdates`;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeout: 20 }),
    });

    const data = await res.json().catch(() => ({}));

    // Trả về 100% nguyên văn toàn bộ response từ Zalo Bot API
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("Lỗi getUpdates Zalo Bot:", err);
    return NextResponse.json(
      { error: err.message || "Không thể gọi getUpdates từ Zalo Bot API." },
      { status: 500 }
    );
  }
}
