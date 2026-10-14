import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings/settings-form";

export const metadata = {
  title: "Cài đặt tài khoản - GroupSplit",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  let user: any = null;

  try {
    user = await prisma.user.findUnique({
      where: { id: session.user.id! },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        isEmailVerified: true,
        avatar: true,
        zaloChatId: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        sepayWebhookSecret: true,
      },
    });
  } catch (err) {
    console.error("[SettingsPage] Lỗi truy vấn:", err);
    // Fallback an toàn nếu database trên Portainer chưa kịp nạp một số cột
    const baseUser = await prisma.user.findUnique({
      where: { id: session.user.id! },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        bankName: true,
        accountNumber: true,
        accountName: true,
        sepayWebhookSecret: true,
      },
    });
    if (baseUser) {
      user = { ...baseUser, email: null, isEmailVerified: false, zaloChatId: null };
    }
  }

  if (!user) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cài đặt tài khoản</h1>
        <p className="text-muted-foreground text-sm">
          Cập nhật thông tin thanh toán ngân hàng và tích hợp SePay Webhook tự động.
        </p>
      </div>

      <SettingsForm user={user} />
    </div>
  );
}
