"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { formatDate } from "@/lib/utils/format";

interface NotificationItem {
  id: string;
  title: string;
  content: string;
  type: string;
  status: "UNREAD" | "READ";
  link?: string;
  entityId?: string;
  entityStatus?: "PENDING" | "ACCEPTED" | "DECLINED" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export function NotificationsClientList({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filtered = notifications.filter((n) =>
    filter === "UNREAD" ? n.status === "UNREAD" : true
  );

  const unreadCount = notifications.filter((n) => n.status === "UNREAD").length;

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
        toast.success("Đã đánh dấu tất cả là đã đọc");
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra");
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
      case "GROUP_INVITE":
      case "JOIN_REQUEST":
        return <UserPlus className="h-5 w-5 text-blue-500 shrink-0" />;
      case "INVITE_ACCEPTED":
      case "JOIN_APPROVED":
      case "EXPENSE_APPROVED":
      case "SETTLEMENT_CONFIRMED":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />;
      case "INVITE_DECLINED":
      case "JOIN_REJECTED":
      case "EXPENSE_REJECTED":
      case "SETTLEMENT_REJECTED":
        return <XCircle className="h-5 w-5 text-rose-500 shrink-0" />;
      case "EXPENSE_PENDING":
        return <Receipt className="h-5 w-5 text-amber-500 shrink-0" />;
      case "SETTLEMENT_PENDING":
        return <ArrowRight className="h-5 w-5 text-purple-500 shrink-0" />;
      default:
        return <Bell className="h-5 w-5 text-primary shrink-0" />;
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={filter === "ALL" ? "default" : "outline"}
            onClick={() => setFilter("ALL")}
            className="h-8 text-xs font-semibold"
          >
            Tất cả ({notifications.length})
          </Button>
          <Button
            size="sm"
            variant={filter === "UNREAD" ? "default" : "outline"}
            onClick={() => setFilter("UNREAD")}
            className="h-8 text-xs font-semibold"
          >
            Chưa đọc ({unreadCount})
          </Button>
        </div>

        {unreadCount > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={markAllAsRead}
            disabled={loading}
            className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <CheckCheck className="h-4 w-4" />
            Đánh dấu tất cả đã đọc
          </Button>
        )}
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Không có thông báo nào trong danh mục này 🎉</p>
            </div>
          ) : (
            filtered.map((n) => {
              const isUnread = n.status === "UNREAD";
              const isProcessing = processingId === n.id;

              return (
                <div
                  key={n.id}
                  className={`p-4 transition-colors flex flex-col gap-3 ${
                    isUnread ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-accent/40"
                  }`}
                >
                  <div
                    onClick={() => handleNotificationClick(n)}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="p-2 rounded-xl bg-muted shrink-0 mt-0.5">
                      {getNotificationIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                            {n.title}
                          </p>
                          {isUnread && (
                            <Badge variant="default" className="h-4 text-[10px] px-1.5 font-bold">
                              Mới
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                          {formatDate(new Date(n.createdAt))}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {n.content}
                      </p>
                    </div>
                  </div>

                  {/* Direct Action buttons or Status badge for Invitations & Join Requests */}
                  {n.type === "GROUP_INVITE" && n.entityId && (
                    <div className="flex items-center gap-2 pl-12">
                      {n.entityStatus === "PENDING" || !n.entityStatus ? (
                        <>
                          <Button
                            size="sm"
                            className="h-8 text-xs px-4 font-semibold gap-1.5"
                            disabled={isProcessing}
                            onClick={() => handleInviteResponse(n.entityId!, "ACCEPT", n.id)}
                          >
                            {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Đồng ý tham gia
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs px-4 font-semibold"
                            disabled={isProcessing}
                            onClick={() => handleInviteResponse(n.entityId!, "DECLINE", n.id)}
                          >
                            Từ chối
                          </Button>
                        </>
                      ) : n.entityStatus === "ACCEPTED" ? (
                        <Badge variant="outline" className="text-xs px-2.5 py-0.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                          ✓ Đã chấp nhận tham gia
                        </Badge>
                      ) : n.entityStatus === "DECLINED" ? (
                        <Badge variant="outline" className="text-xs px-2.5 py-0.5 border-muted-foreground/30 text-muted-foreground bg-muted/40">
                          ✕ Đã từ chối lời mời
                        </Badge>
                      ) : null}
                    </div>
                  )}

                  {n.type === "JOIN_REQUEST" && n.entityId && (
                    <div className="flex items-center gap-2 pl-12">
                      {n.entityStatus === "PENDING" || !n.entityStatus ? (
                        <>
                          <Button
                            size="sm"
                            className="h-8 text-xs px-4 font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={isProcessing}
                            onClick={() => handleJoinRequestResponse(n.entityId!, "APPROVE", n.id)}
                          >
                            {isProcessing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Phê duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs px-4 font-semibold text-rose-500 hover:text-rose-600"
                            disabled={isProcessing}
                            onClick={() => handleJoinRequestResponse(n.entityId!, "REJECT", n.id)}
                          >
                            Từ chối
                          </Button>
                        </>
                      ) : n.entityStatus === "APPROVED" ? (
                        <Badge variant="outline" className="text-xs px-2.5 py-0.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                          ✓ Đã phê duyệt
                        </Badge>
                      ) : n.entityStatus === "REJECTED" ? (
                        <Badge variant="outline" className="text-xs px-2.5 py-0.5 border-muted-foreground/30 text-muted-foreground bg-muted/40">
                          ✕ Đã từ chối
                        </Badge>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
