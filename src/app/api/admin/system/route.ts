import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function verifyAdmin() {
  const session = await auth();
  if (!session?.user) return null;

  const user = session.user as any;
  const isAdmin = user.username === "qy286" || user.role === "ADMIN";

  if (!isAdmin) return null;
  return user;
}

// 1. GET: Lấy cấu hình hệ thống & Thống kê Admin
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Quyền truy cập bị từ chối" }, { status: 403 });
  }

  try {
    const [totalUsers, totalGroups, totalExpenses, totalSettlements, settings] =
      await Promise.all([
        prisma.user.count(),
        prisma.group.count(),
        prisma.expense.count(),
        prisma.settlement.count(),
        prisma.systemSetting.findMany(),
      ]);

    const settingsMap = Object.fromEntries(
      settings.map((s) => [s.key, s.value])
    );

    return NextResponse.json({
      stats: {
        totalUsers,
        totalGroups,
        totalExpenses,
        totalSettlements,
      },
      resend: {
        apiKey: settingsMap.RESEND_API || process.env.RESEND_API || process.env.RESEND_API_KEY || "",
        from: settingsMap.EMAIL_FROM || process.env.EMAIL_FROM || process.env.RESEND_FROM || "GroupSplit <support@qy286.me>",
      },
      smtp: {
        host: settingsMap.SMTP_HOST || process.env.SMTP_HOST || "",
        port: settingsMap.SMTP_PORT || process.env.SMTP_PORT || "587",
        user: settingsMap.SMTP_USER || process.env.SMTP_USER || "",
        pass: settingsMap.SMTP_PASS || process.env.SMTP_PASS || "",
        from: settingsMap.SMTP_FROM || process.env.SMTP_FROM || "",
        secure: settingsMap.SMTP_SECURE || process.env.SMTP_SECURE || "false",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 2. POST: Lưu cấu hình Resend / SMTP trong bảng SystemSetting
export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Quyền truy cập bị từ chối" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { host, port, user, pass, from, secure, resendApiKey, resendFrom } = body;

    const updates: { key: string; value: string }[] = [];

    if (resendApiKey !== undefined) {
      updates.push({ key: "RESEND_API", value: resendApiKey || "" });
    }
    if (resendFrom !== undefined) {
      updates.push({ key: "EMAIL_FROM", value: resendFrom || "" });
    }
    if (host !== undefined) {
      updates.push({ key: "SMTP_HOST", value: host || "" });
    }
    if (port !== undefined) {
      updates.push({ key: "SMTP_PORT", value: String(port || "587") });
    }
    if (user !== undefined) {
      updates.push({ key: "SMTP_USER", value: user || "" });
    }
    if (pass !== undefined) {
      updates.push({ key: "SMTP_PASS", value: pass || "" });
    }
    if (from !== undefined) {
      updates.push({ key: "SMTP_FROM", value: from || "" });
    }
    if (secure !== undefined) {
      updates.push({ key: "SMTP_SECURE", value: String(!!secure) });
    }

    for (const item of updates) {
      await prisma.systemSetting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Đã lưu cấu hình Email thành công!",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
