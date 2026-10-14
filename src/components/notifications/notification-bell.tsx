"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  XCircle,
  UserPlus,
  Receipt,
  ArrowRight,
  Loader2,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";

interface NotificationItem {
  id: string;
  userId?: string;
  title: string;
  content: string;
  type: string;
  status: "UNREAD" | "READ";
  link?: string;
  entityId?: string;
  entityStatus?: "PENDING" | "ACCEPTED" | "DECLINED" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Fetch notifications error:", err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 12000); // Polling every 12s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markAllAsRead() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, status: "READ" }))
        );
        setUnreadCount(0);
        toast.success("Đã đánh dấu tất cả là đã đọc");
      }
    } catch (err) {
      toast.error("Lỗi khi cập nhật thông báo");
    } finally {
      setLoading(false);
    }
  }

  async function handleNotificationClick(n: NotificationItem) {
    if (n.status === "UNREAD") {
      fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      }).then(() => {
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, status: "READ" } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      });
    }
    if (n.link) {
      router.push(n.link);
    }
  }

  async function handleInviteResponse(invitationId: string, action: "ACCEPT" | "DECLINE", notificationId: string) {
    setProcessingId(notificationId);
    try {
      const res = await fetch(`/api/invitations/${invitationId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notificationId
              ? { ...item, status: "READ", entityStatus: action === "ACCEPT" ? "ACCEPTED" : "DECLINED" }
              : item
          )
        );
        router.refresh();
      } else {
        toast.error(data.error || "Xử lý lời mời thất bại");
      }
    } catch (err) {
      toast.error("Đã xảy ra lỗi kết nối");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleJoinRequestResponse(requestId: string, action: "APPROVE" | "REJECT", notificationId: string) {
    setProcessingId(notificationId);
    try {
      const res = await fetch(`/api/join-requests/${requestId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notificationId
              ? { ...item, status: "READ", entityStatus: action === "APPROVE" ? "APPROVED" : "REJECTED" }
              : item
          )
        );
        router.refresh();
      } else {
        toast.error(data.error || "Xử lý yêu cầu thất bại");
      }
    } catch (err) {
      toast.error("Đã xảy ra lỗi kết nối");
    } finally {
      setProcessingId(null);
    }
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case "EXPENSE_CREATED":
      case "EXPENSE_APPROVED":
        return <Receipt className="h-4 w-4 text-emerald-500 shrink-0" />;
      case "EXPENSE_PENDING":
        return <Receipt className="h-4 w-4 text-amber-500 shrink-0" />;
      case "EXPENSE_REJECTED":
        return <XCircle className="h-4 w-4 text-rose-500 shrink-0" />;
      case "GROUP_INVITE":
      case "JOIN_REQUEST":
        return <UserPlus className="h-4 w-4 text-blue-500 shrink-0" />;
      case "SETTLEMENT_CREATED":
      case "SETTLEMENT_CONFIRMED":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
      case "FUND_ALLOCATION":
        return <ArrowRight className="h-4 w-4 text-purple-500 shrink-0" />;
      default:
        return <Bell className="h-4 w-4 text-primary shrink-0" />;
    }
  }

  return (
    <Popover>
      <PopoverTrigger className="relative inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none cursor-pointer" aria-label="Thông báo">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 max-w-[calc(100vw-2rem)] p-0 shadow-xl border rounded-xl" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Thông báo</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-bold">
                {unreadCount} mới
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={loading}
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2 cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Đã đọc tất cả
            </Button>
          )}
        </div>

        {/* Body list */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border scrollbar-thin">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs">
              Bạn chưa có thông báo nào 🎉
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = n.status === "UNREAD";
              const isProcessing = processingId === n.id;

              return (
                <div
                  key={n.id}
                  className={`p-3 text-xs transition-colors flex flex-col gap-2 ${
                    isUnread ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-accent/40"
                  }`}
                >
                  <div
                    onClick={() => handleNotificationClick(n)}
                    className="flex gap-2.5 items-start cursor-pointer group"
                  >
                    <div className="mt-0.5">{getNotificationIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {n.title}
                        </p>
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs leading-relaxed">{n.content}</p>
                    </div>
                  </div>

                  {/* Direct Action buttons or Status badge for Invitations & Join Requests */}
                  {n.type === "GROUP_INVITE" && n.entityId && (
                    <div className="flex items-center gap-2 pl-6 pt-1">
                      {n.entityStatus === "PENDING" || !n.entityStatus ? (
                        <>
                          <Button
                            size="sm"
                            className="h-7 text-xs px-3 font-semibold gap-1 bg-primary text-primary-foreground cursor-pointer"
                            disabled={isProcessing}
                            onClick={() => handleInviteResponse(n.entityId!, "ACCEPT", n.id)}
                          >
                            {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
                            Đồng ý
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-3 font-semibold cursor-pointer"
                            disabled={isProcessing}
                            onClick={() => handleInviteResponse(n.entityId!, "DECLINE", n.id)}
                          >
                            Từ chối
                          </Button>
                        </>
                      ) : n.entityStatus === "ACCEPTED" ? (
                        <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                          ✓ Đã chấp nhận
                        </Badge>
                      ) : n.entityStatus === "DECLINED" ? (
                        <Badge variant="outline" className="text-[10px] h-5 border-muted-foreground/30 text-muted-foreground bg-muted/40">
                          ✕ Đã từ chối
                        </Badge>
                      ) : null}
                    </div>
                  )}

                  {n.type === "JOIN_REQUEST" && n.entityId && (
                    <div className="flex items-center gap-2 pl-6 pt-1">
                      {n.entityStatus === "PENDING" || !n.entityStatus ? (
                        <>
                          <Button
                            size="sm"
                            className="h-7 text-xs px-3 font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                            disabled={isProcessing}
                            onClick={() => handleJoinRequestResponse(n.entityId!, "APPROVE", n.id)}
                          >
                            {isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-3 font-semibold text-rose-500 hover:text-rose-600 cursor-pointer"
                            disabled={isProcessing}
                            onClick={() => handleJoinRequestResponse(n.entityId!, "REJECT", n.id)}
                          >
                            Từ chối
                          </Button>
                        </>
                      ) : n.entityStatus === "APPROVED" ? (
                        <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                          ✓ Đã phê duyệt
                        </Badge>
                      ) : n.entityStatus === "REJECTED" ? (
                        <Badge variant="outline" className="text-[10px] h-5 border-muted-foreground/30 text-muted-foreground bg-muted/40">
                          ✕ Đã từ chối
                        </Badge>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t text-center bg-muted/20">
          <Link
            href="/notifications"
            className="block w-full py-1.5 text-xs text-center text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            Xem tất cả thông báo
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
