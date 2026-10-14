"use client";

import { useState, useMemo } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatVND, formatDate, getInitials } from "@/lib/utils/format";
import {
  Coins,
  Calendar,
  ChevronDown,
  Check,
  ArrowLeft,
  ArrowRight,
  Wallet,
  Users,
  Plus,
  Sparkles,
} from "lucide-react";
import { FundAllocationForm } from "./fund-allocation-form";

interface Member {
  userId: string;
  user: {
    id: string;
    displayName: string;
    avatar: string | null;
    username?: string;
  };
}

interface FundAllocation {
  id: string;
  amount: number;
  note: string | null;
  date: string | Date;
  createdAt?: string | Date;
  fromUserId: string;
  fromUserName?: string;
  fromUser?: {
    id: string;
    displayName: string;
    avatar?: string | null;
  };
  toUserId: string;
  toUserName?: string;
  toUser?: {
    id: string;
    displayName: string;
    avatar?: string | null;
  };
}

interface FundAllocationsSectionProps {
  groupId: string;
  fundAllocations: FundAllocation[];
  members: Member[];
  currentUserId: string;
  isFundManager: boolean;
}

interface RecipientItem {
  userId: string;
  displayName: string;
  avatar: string | null;
}

interface AllocationBatch {
  id: string;
  date: Date | string;
  amount: number;
  note: string | null;
  fromUserId: string;
  fromUserName: string;
  recipients: RecipientItem[];
  totalAmount: number;
}

export function FundAllocationsSection({
  groupId,
  fundAllocations = [],
  members = [],
  currentUserId,
  isFundManager,
}: FundAllocationsSectionProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Group allocations into logical batches
  const batches: AllocationBatch[] = useMemo(() => {
    const map: Record<string, AllocationBatch> = {};

    for (const curr of fundAllocations || []) {
      if (!curr) continue;
      const rawDate: any = curr.date;
      let dateStr = "";
      if (typeof rawDate === "string") {
        dateStr = rawDate.split("T")[0];
      } else if (rawDate && typeof rawDate === "object" && "toISOString" in rawDate) {
        dateStr = (rawDate as Date).toISOString().split("T")[0];
      }

      // Determine createdAt slice if available to separate batches on same day
      const batchTime = curr.createdAt
        ? new Date(curr.createdAt).toISOString().slice(0, 16)
        : dateStr;

      const fromUser = curr.fromUser || members.find((m) => m?.userId === curr.fromUserId)?.user;
      const fromName = curr.fromUserName || fromUser?.displayName || "Người quản lý quỹ";

      const toUser = curr.toUser || members.find((m) => m?.userId === curr.toUserId)?.user;
      const toName = curr.toUserName || toUser?.displayName || "Thành viên";
      const toAvatar = toUser?.avatar || null;

      const key = `${dateStr}_${curr.fromUserId || ""}_${curr.amount || 0}_${curr.note || ""}_${batchTime}`;

      if (!map[key]) {
        map[key] = {
          id: key,
          date: rawDate,
          amount: curr.amount || 0,
          note: curr.note || null,
          fromUserId: curr.fromUserId,
          fromUserName: fromName,
          recipients: [],
          totalAmount: 0,
        };
      }

      map[key].recipients.push({
        userId: curr.toUserId,
        displayName: toName,
        avatar: toAvatar,
      });
      map[key].totalAmount += curr.amount || 0;
    }

    return Object.values(map).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [fundAllocations, members]);

  // Filter batches by recipient member and date range
  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      // Filter by recipient member
      if (selectedMemberId !== "all") {
        const hasRecipient = batch.recipients.some((r) => r.userId === selectedMemberId);
        if (!hasRecipient) return false;
      }

      // Filter by date range
      const bTime = new Date(batch.date).getTime();
      if (dateRange?.from) {
        const fromTime = new Date(dateRange.from).setHours(0, 0, 0, 0);
        if (bTime < fromTime) return false;
      }
      if (dateRange?.to) {
        const toTime = new Date(dateRange.to).setHours(23, 59, 59, 999);
        if (bTime > toTime) return false;
      }

      return true;
    });
  }, [batches, selectedMemberId, dateRange]);

  // Pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBatches.slice(start, start + itemsPerPage);
  }, [filteredBatches, currentPage]);

  // Statistics
  const totalAllocatedAmount = useMemo(() => {
    return filteredBatches.reduce((sum, b) => {
      if (selectedMemberId !== "all") {
        // Only count for the selected member
        const count = b.recipients.filter((r) => r.userId === selectedMemberId).length;
        return sum + b.amount * count;
      }
      return sum + b.totalAmount;
    }, 0);
  }, [filteredBatches, selectedMemberId]);

  const totalRecipientsCount = useMemo(() => {
    return filteredBatches.reduce((sum, b) => {
      if (selectedMemberId !== "all") {
        return sum + b.recipients.filter((r) => r.userId === selectedMemberId).length;
      }
      return sum + b.recipients.length;
    }, 0);
  }, [filteredBatches, selectedMemberId]);

  const selectedMemberName = useMemo(() => {
    if (selectedMemberId === "all") return null;
    return members.find((m) => m?.userId === selectedMemberId)?.user?.displayName || null;
  }, [selectedMemberId, members]);

  return (
    <div className="space-y-6">
      {/* Header card with action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Lịch sử cấp quỹ
                {batches.length > 0 && (
                  <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold">
                    {batches.length} đợt
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                Theo dõi chi tiết các đợt phát quỹ hoạt động cho thành viên
              </p>
            </div>
          </div>
        </div>

        {isFundManager && (
          <Button
            onClick={() => setIsFormOpen(true)}
            size="default"
            className="gap-2 font-bold shadow-md rounded-xl bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700 shrink-0 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Cấp tiền quỹ</span>
          </Button>
        )}
      </div>

      {/* Summary statistics */}
      {batches.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">
                  {selectedMemberId !== "all" ? `Tiền nhận (${selectedMemberName})` : "Tổng tiền đã cấp"}
                </p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400 font-mono truncate">
                  {formatVND(totalAllocatedAmount)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Coins className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">Số đợt cấp quỹ</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono truncate">
                  {filteredBatches.length} <span className="text-xs font-normal text-muted-foreground">đợt</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border bg-card shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">Lượt nhận tiền</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono truncate">
                  {totalRecipientsCount} <span className="text-xs font-normal text-muted-foreground">lượt</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter bar */}
      {batches.length > 0 && (
        <Card className="border shadow-sm">
          <CardContent className="p-3.5 sm:p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="text-left space-y-0.5">
              <h4 className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                Bộ lọc lịch sử cấp quỹ
              </h4>
              <p className="text-[11px] text-muted-foreground">Lọc theo thành viên nhận hoặc thời gian</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-end">
              {/* Member filter */}
              <div className="w-full sm:w-[200px] shrink-0">
                <Popover>
                  <PopoverTrigger
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "w-full sm:w-[200px] justify-between text-left font-normal h-9 text-xs select-none cursor-pointer"
                    )}
                  >
                    <span className="truncate">{selectedMemberName || "Tất cả người nhận"}</span>
                    <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-1 z-50 bg-popover border border-border shadow-md rounded-lg" align="start">
                    <div className="flex flex-col gap-0.5 max-h-[260px] overflow-y-auto">
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
                        <span>Tất cả người nhận</span>
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

              {/* Date filter */}
              <DateRangePicker
                value={dateRange}
                onChange={(range) => {
                  setDateRange(range);
                  setCurrentPage(1);
                }}
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
                  className="h-9 text-xs text-destructive hover:bg-destructive/5 shrink-0"
                >
                  Xoá lọc
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batches List */}
      {paginatedBatches.length > 0 ? (
        <div className="space-y-3">
          {paginatedBatches.map((batch) => {
            return (
              <Card
                key={batch.id}
                className="overflow-hidden border border-amber-500/20 bg-card hover:border-amber-500/40 transition-all shadow-sm"
              >
                <CardContent className="p-4 sm:p-5 space-y-3">
                  {/* Top info row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 font-mono tracking-tight">
                        +{formatVND(batch.amount)}
                        <span className="text-xs font-semibold text-muted-foreground ml-1">/ người</span>
                      </span>

                      {batch.note && (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-xs font-medium max-w-[260px] truncate"
                        >
                          {batch.note}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        Tổng đợt: <span className="text-amber-600 dark:text-amber-400 font-mono font-bold">{formatVND(batch.totalAmount)}</span>
                      </span>
                      <span className="hidden sm:inline text-muted-foreground/40">•</span>
                      <span className="text-[11px] font-medium font-mono text-muted-foreground">
                        Phát bởi: <span className="font-semibold text-foreground">{batch.fromUserName}</span> • {formatDate(batch.date)}
                      </span>
                    </div>
                  </div>

                  {/* Recipients list */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Người nhận ({batch.recipients.length} thành viên):
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {batch.recipients.map((recipient, idx) => {
                        const isSelected = selectedMemberId === recipient.userId;
                        return (
                          <div
                            key={`${recipient.userId}_${idx}`}
                            className={cn(
                              "inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg border text-xs transition-colors",
                              isSelected
                                ? "bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200 font-bold shadow-xs"
                                : "bg-muted/40 hover:bg-muted border-border/60 text-foreground font-medium"
                            )}
                          >
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={recipient.avatar || undefined} alt={recipient.displayName} />
                              <AvatarFallback className="text-[9px] font-bold">
                                {getInitials(recipient.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[120px]">{recipient.displayName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 px-1 border-t">
              <span className="text-xs text-muted-foreground">
                Trang {currentPage} / {totalPages} (Tổng {filteredBatches.length} đợt cấp)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-8 gap-1 font-semibold text-xs cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="h-8 gap-1 font-semibold text-xs cursor-pointer"
                >
                  Trang sau
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : batches.length > 0 ? (
        /* Empty filtered state */
        <Card className="border border-dashed shadow-sm">
          <CardContent className="py-12 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-sm">Không tìm thấy đợt cấp quỹ nào</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Không có lịch sử cấp quỹ nào khớp với tiêu chí bộ lọc đã chọn.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDateRange(undefined);
                setSelectedMemberId("all");
                setCurrentPage(1);
              }}
              className="text-xs cursor-pointer"
            >
              Xoá bộ lọc
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Empty total state */
        <Card className="border border-dashed shadow-sm">
          <CardContent className="py-14 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Coins className="h-8 w-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="font-bold text-base">Chưa có lịch sử cấp quỹ</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nhóm chưa thực hiện đợt cấp quỹ nào. Khi người quản lý quỹ cấp tiền cho các thành viên, lịch sử cấp quỹ chi tiết sẽ hiển thị tại đây.
              </p>
            </div>
            {isFundManager && (
              <Button
                onClick={() => setIsFormOpen(true)}
                className="gap-2 font-bold shadow-md rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Cấp tiền quỹ ngay</span>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fund Allocation Modal */}
      <FundAllocationForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        groupId={groupId}
        members={members}
      />
    </div>
  );
}
