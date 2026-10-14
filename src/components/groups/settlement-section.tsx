"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatVND, formatDate, getInitials } from "@/lib/utils/format";
import { ArrowRight, CheckCircle2, Clock, Loader2, QrCode, Copy, Check, Banknote, HelpCircle, Calendar, ArrowLeft, ChevronDown, FileText } from "lucide-react";
import type { DebtEntry } from "@/lib/debt-calculator";
import { DebtBreakdownDialog } from "./debt-breakdown-dialog";

interface Settlement {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
  isConfirmed: boolean;
  createdAt: string;
  note: string | null;
}

interface Member {
  userId: string;
  user: {
    id: string;
    displayName: string;
    bankName: string | null;
    accountNumber: string | null;
    accountName: string | null;
    hasSepay: boolean;
    avatar: string | null;
  };
}

interface SettlementSectionProps {
  debts: DebtEntry[];
  groupId: string;
  currentUserId: string;
  owner: {
    id: string;
    displayName: string;
    bankName: string | null;
    accountNumber: string | null;
    accountName: string | null;
  };
  members: Member[];
  settlements: Settlement[];
  fundManagerId: string | null;
  fundAllocations: Array<{
    id: string;
    amount: number;
    note: string | null;
    date: string;
    fromUserId: string;
    fromUserName: string;
    toUserId: string;
    toUserName: string;
  }>;
}



export function SettlementSection({
  debts,
  groupId,
  currentUserId,
  owner,
  members,
  settlements,
  fundManagerId,
  fundAllocations,
}: SettlementSectionProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [breakdownDebt, setBreakdownDebt] = useState<DebtEntry | null>(null);

  const visibleSettlements = (settlements || []).filter(
    (s) => !(s?.note?.startsWith("[QR_PENDING]") && !s?.isConfirmed)
  );

  const filteredSettlements = visibleSettlements.filter((s) => {
    if (!s) return false;
    if (selectedMemberId !== "all" && s.fromUserId !== selectedMemberId && s.toUserId !== selectedMemberId) {
      return false;
    }
    const sTime = new Date(s.createdAt).getTime();
    if (dateRange?.from) {
      const fromTime = new Date(dateRange.from).setHours(0, 0, 0, 0);
      if (sTime < fromTime) return false;
    }
    if (dateRange?.to) {
      const toTime = new Date(dateRange.to).setHours(23, 59, 59, 999);
      if (sTime > toTime) return false;
    }
    return true;
  });

  // Sort by date newest first
  const sortedSettlements = [...filteredSettlements].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Pagination config
  const itemsPerPage = 10;
  const totalPages = Math.ceil(sortedSettlements.length / itemsPerPage);
  const paginatedSettlements = sortedSettlements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Group by Month function
  const groupSettlementsByMonth = (list: Settlement[]) => {
    const groups: Record<string, Settlement[]> = {};
    for (const s of list) {
      if (!s) continue;
      const d = new Date(s.createdAt);
      const monthStr = isNaN(d.getTime())
        ? "Khác"
        : `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      if (!groups[monthStr]) {
        groups[monthStr] = [];
      }
      groups[monthStr].push(s);
    }
    return groups;
  };

  const groupedSettlements = groupSettlementsByMonth(paginatedSettlements);

  const otherDebts = (debts || []).filter((d) => d && d.fromUserId !== currentUserId);

  const selectedMemberName = selectedMemberId !== "all"
    ? (members || []).find((m) => m?.userId === selectedMemberId)?.user?.displayName || null
    : null;





  // Xác nhận nhận tiền thủ công
  async function confirmSettlement(settlementId: string) {
    setLoadingId(settlementId);

    const res = await fetch(`/api/settlements/[id]/confirm`.replace("[id]", settlementId), {
      method: "PATCH",
    });

    setLoadingId(null);

    if (res.ok) {
      toast.success("Đã xác nhận nhận tiền!");
      router.refresh();
    } else {
      toast.error("Có lỗi xảy ra");
    }
  }

  // Từ chối yêu cầu thanh toán (chưa nhận được tiền)
  async function rejectSettlement(settlementId: string) {
    setLoadingId(settlementId);

    try {
      const res = await fetch(`/api/settlements/${settlementId}`, {
        method: "DELETE",
      });

      setLoadingId(null);

      if (res.ok) {
        toast.success("Đã từ chối yêu cầu thanh toán!");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Có lỗi xảy ra");
      }
    } catch (err) {
      setLoadingId(null);
      toast.error("Lỗi kết nối máy chủ");
    }
  }



  return (
    <div className="space-y-6">
      {/* Bộ lọc hiển thị */}
      <Card>
        <CardContent className="pt-4 pb-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="text-left w-full md:w-auto space-y-0.5">
            <h4 className="font-bold text-sm flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              Bộ lọc dữ liệu
            </h4>
            <p className="text-[11px] text-muted-foreground">Lọc lịch sử thanh toán của nhóm</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center justify-start md:justify-end">
            {/* Lọc theo thành viên */}
            <div className="w-full sm:w-[180px] shrink-0">
              <Popover>
                <PopoverTrigger
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full sm:w-[180px] justify-between text-left font-normal h-9 text-xs select-none cursor-pointer"
                  )}
                >
                  <span className="truncate">{selectedMemberName || "Tất cả thành viên"}</span>
                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                </PopoverTrigger>
                <PopoverContent className="w-[180px] p-1 z-50 bg-popover border border-border shadow-md rounded-lg" align="start">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => {
                        setSelectedMemberId("all");
                        setCurrentPage(1);
                      }}
                      className={cn(
                        "flex items-center justify-between text-xs px-2.5 py-2 rounded-md hover:bg-muted text-left transition-colors cursor-pointer w-full select-none",
                        selectedMemberId === "all" && "bg-primary/10 text-primary font-medium hover:bg-primary/15"
                      )}
                    >
                      <span>Tất cả thành viên</span>
                      {selectedMemberId === "all" && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                    {members.map((m) => (
                      <button
                        key={m.userId}
                        onClick={() => {
                          setSelectedMemberId(m.userId);
                          setCurrentPage(1);
                        }}
                        className={cn(
                          "flex items-center justify-between text-xs px-2.5 py-2 rounded-md hover:bg-muted text-left transition-colors cursor-pointer w-full select-none",
                          selectedMemberId === m.userId && "bg-primary/10 text-primary font-medium hover:bg-primary/15"
                        )}
                      >
                        <span className="truncate pr-2">{m.user.displayName}</span>
                        {selectedMemberId === m.userId && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Lọc theo thời gian */}
            <DateRangePicker
              value={dateRange}
              onChange={(range) => { setDateRange(range); setCurrentPage(1); }}
              placeholder="Chọn khoảng ngày"
            />

            {(dateRange || selectedMemberId !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateRange(undefined);
                  setSelectedMemberId("all");
                  setCurrentPage(1);
                }}
                className="h-8 text-xs text-destructive hover:bg-destructive/5 shrink-0 self-start sm:self-auto"
              >
                Xóa lọc
              </Button>
            )}
          </div>
        </CardContent>
      </Card>



      {/* Pending debts */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <h3 className="font-semibold text-sm">Cần thanh toán</h3>
          {otherDebts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500 opacity-50" />
              <p className="text-sm text-muted-foreground">
                Mọi người đã hạch toán sạch! 🎉
              </p>
            </div>
          ) : (
            otherDebts.map((debt) => {
              const key = `${debt.fromUserId}-${debt.toUserId}`;
              const hasPending = visibleSettlements.some(
                (s) =>
                  s.fromUserId === debt.fromUserId &&
                  s.toUserId === debt.toUserId &&
                  !s.isConfirmed
              );
                  const fromMember = members.find((m) => m.userId === debt.fromUserId);
                  const toMember = members.find((m) => m.userId === debt.toUserId);
                  const fromAvatar = fromMember?.user.avatar;
                  const toAvatar = toMember?.user.avatar;

                  return (
                    <div
                      key={key}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border/50 bg-muted/20 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Avatar className="h-8 w-8 shrink-0">
                          {fromAvatar && (
                            <AvatarImage src={fromAvatar} alt={debt.fromUserName} className="object-cover" />
                          )}
                          <AvatarFallback className={`text-xs ${debt.fromUserId === currentUserId ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : ""}`}>
                            {getInitials(debt.fromUserName)}
                          </AvatarFallback>
                        </Avatar>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Avatar className="h-8 w-8 shrink-0">
                          {toAvatar && (
                            <AvatarImage src={toAvatar} alt={debt.toUserName} className="object-cover" />
                          )}
                          <AvatarFallback className={`text-xs ${debt.toUserId === currentUserId ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : ""}`}>
                            {getInitials(debt.toUserName)}
                          </AvatarFallback>
                        </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        <span className={debt.fromUserId === currentUserId ? "text-blue-600 dark:text-blue-400 font-bold" : ""}>
                          {debt.fromUserId === currentUserId ? "Bạn" : debt.fromUserName}
                        </span>
                        {" → "}
                        <span className={debt.toUserId === currentUserId ? "text-blue-600 dark:text-blue-400 font-bold" : ""}>
                          {debt.toUserId === currentUserId ? "Bạn" : debt.toUserName}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Cần thanh toán
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBreakdownDebt(debt)}
                      className="h-7 px-2 text-[11px] font-semibold gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Xem chi tiết các hóa đơn cấu thành khoản nợ"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Chi tiết</span>
                    </Button>
                    <Badge
                      variant="outline"
                      className="text-sm px-3 py-1"
                    >
                      {formatVND(debt.amount)}
                    </Badge>
                    {hasPending && (
                      <Badge
                        variant="outline"
                        className="gap-1 font-bold text-xs bg-amber-500/10 text-amber-600 border border-amber-500/20 opacity-100 h-7"
                      >
                        <Clock className="h-3.5 w-3.5 animate-pulse" />
                        Đã chuyển (Chờ duyệt)
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Settlement history */}
      {filteredSettlements.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <h3 className="font-semibold text-sm">Lịch sử thanh toán</h3>
            
            <div className="space-y-6">
              {Object.entries(groupedSettlements).map(([monthHeader, list]) => (
                <div key={monthHeader} className="space-y-3">
                  <div className="flex items-center gap-2 px-1 py-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                      {monthHeader}
                    </span>
                    <div className="h-px bg-border flex-1" />
                  </div>

                  {list.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-muted/50 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex items-center gap-1">
                          {s.isConfirmed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className={`font-semibold ${s.fromUserId === currentUserId ? "text-blue-600 dark:text-blue-400" : ""}`}>
                              {s.fromUserId === currentUserId ? "Bạn" : (s as any).fromUser?.displayName || s.fromUserName || "Thành viên"}
                            </span>
                            {" → "}
                            <span className={`font-semibold ${s.toUserId === currentUserId ? "text-blue-600 dark:text-blue-400" : ""}`}>
                              {s.toUserId === currentUserId ? "Bạn" : (s as any).toUser?.displayName || s.toUserName || "Thành viên"}
                            </span>
                            <span className="text-muted-foreground ml-2 font-mono">
                              {formatVND(s.amount)}
                            </span>
                          </p>
                          {s.note && <p className="text-[10px] text-muted-foreground mt-0.5">{s.note.replace(/^\[QR_PENDING\]\s*/, "")}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatDate(s.createdAt)}
                        </span>
                        {!s.isConfirmed && s.toUserId === currentUserId && (
                          <div className="flex gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => confirmSettlement(s.id)}
                              disabled={loadingId === s.id}
                              className="h-7 px-2.5 text-xs gap-1 font-bold bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:text-white"
                            >
                              {loadingId === s.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : null}
                              Đã nhận
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectSettlement(s.id)}
                              disabled={loadingId === s.id}
                              className="h-7 px-2.5 text-xs gap-1 font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-200"
                            >
                              Chưa nhận được
                            </Button>
                          </div>
                        )}
                        {s.isConfirmed && (
                          <Badge variant="secondary" className="text-xs shrink-0 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            Đã nhận tiền
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Pagination for Settlements */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 px-1 border-t mt-4">
                <span className="text-xs text-muted-foreground">
                  Trang {currentPage} / {totalPages} (Tổng {filteredSettlements.length} giao dịch)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="h-8 gap-1 font-semibold text-xs"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Trang trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="h-8 gap-1 font-semibold text-xs"
                  >
                    Trang sau
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {visibleSettlements.length > 0 && filteredSettlements.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-xs">
            Không tìm thấy lịch sử thanh toán khớp với bộ lọc
          </CardContent>
        </Card>
      )}



      <DebtBreakdownDialog
        debt={breakdownDebt}
        onClose={() => setBreakdownDebt(null)}
        groupId={groupId}
        settlements={settlements}
        fundAllocations={fundAllocations}
      />
    </div>
  );
}
