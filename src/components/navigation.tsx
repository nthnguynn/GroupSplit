"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import {
  LayoutDashboard,
  Users,
  Plus,
  Settings,
  ShieldCheck,
} from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isAdmin = user?.username === "qy286" || user?.role === "ADMIN";

  const items = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/groups", label: "Nhóm", icon: Users },
    { href: "/settings", label: "Cài đặt", icon: Settings },
    ...(isAdmin
      ? [{ href: "/admin", label: "Quản trị", icon: ShieldCheck }]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div
        className={cn(
          "grid items-center justify-items-center h-16 px-2",
          isAdmin ? "grid-cols-4" : "grid-cols-3"
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-1.5 px-2 rounded-xl transition-all w-full h-12",
                isActive
                  ? "text-primary bg-primary/10 font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent font-medium"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-[11px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;
  const isAdmin = user?.username === "qy286" || user?.role === "ADMIN";

  const items = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/groups", label: "Nhóm", icon: Users },
    { href: "/settings", label: "Cài đặt", icon: Settings },
    ...(isAdmin
      ? [{ href: "/admin", label: "Quản trị Admin", icon: ShieldCheck }]
      : []),
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen border-r bg-background/95 backdrop-blur">
      <div className="flex items-center px-6 py-5 border-b">
        <BrandLogo size="md" href="/dashboard" />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function FloatingCreateGroupButton() {
  const pathname = usePathname();

  if (
    pathname === "/groups/new" ||
    pathname.includes("/expenses/new") ||
    pathname.includes("/groups/join") ||
    pathname.startsWith("/admin")
  ) {
    return null;
  }

  const groupMatch = pathname.match(/^\/groups\/([^/]+)$/);
  const isGroupDetail =
    groupMatch && groupMatch[1] !== "new" && groupMatch[1] !== "join";

  const href = isGroupDetail
    ? `/groups/${groupMatch[1]}/expenses/new`
    : "/groups/new";
  const label = isGroupDetail ? "Thêm hoá đơn" : "Tạo nhóm mới";

  return (
    <Link
      href={href}
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 flex items-center justify-center w-14 h-14 md:w-auto md:h-11 md:px-4 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 gap-2 group/fab"
      aria-label={label}
    >
      <Plus className="h-6 w-6 md:h-4 md:w-4 transition-transform group-hover/fab:rotate-90 duration-300" />
      <span className="hidden md:inline text-sm font-bold tracking-wide">
        {label}
      </span>
    </Link>
  );
}
