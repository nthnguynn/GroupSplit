import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar, BottomNav, FloatingCreateGroupButton } from "@/components/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { BrandLogo } from "@/components/brand-logo";
import { prisma } from "@/lib/prisma";

import { NotificationBell } from "@/components/notifications/notification-bell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  // Lấy dữ liệu người dùng mới nhất từ DB
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true, username: true, avatar: true },
  });

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4 md:px-6">
          <div className="md:hidden flex items-center">
            <BrandLogo size="sm" href="/dashboard" />
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <UserMenu
              user={{
                name: dbUser?.displayName || session.user.name || "",
                username: dbUser?.username || "",
                image: dbUser?.avatar,
              }}
            />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 pb-36 md:pb-24">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* Floating Action Button */}
      <FloatingCreateGroupButton />
    </div>
  );
}
