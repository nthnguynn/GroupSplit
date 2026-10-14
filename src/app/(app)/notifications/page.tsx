import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NotificationsClientList } from "@/components/notifications/notifications-client-list";
import { enrichNotifications } from "@/lib/notifications";

export const metadata = {
  title: "Thông báo - GroupSplit",
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user.id!;

  const rawNotifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const notifications = await enrichNotifications(rawNotifications);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Thông báo</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý các lời mời tham gia nhóm, cập nhật hóa đơn và thanh toán.
          </p>
        </div>
      </div>

      <NotificationsClientList
        initialNotifications={notifications.map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          type: n.type,
          status: n.status,
          link: n.link ?? undefined,
          entityId: n.entityId ?? undefined,
          entityStatus: n.entityStatus,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
