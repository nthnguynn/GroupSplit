"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatVND, formatDate, getInitials } from "@/lib/utils/format";
import {
  Wallet,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  QrCode,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Receipt,
  Users,
  ShieldCheck,
  Calendar,
  Clock,
  Trash2,
} from "lucide-react";
import { FundContributionDialog } from "./fund-contribution-dialog";
import Link from "next/link";

interface Member {
  userId: string;
  user: {
    id: string;
    displayName: string;
    avatar: string | null;
    username?: string;
  };
}

interface FundContribution {
  id: string;
  amount: number;
  note: string | null;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | string;
  createdAt: string | Date;
  confirmedAt?: string | Date | null;
  userId: string;
  user?: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
}

interface FundExpense {
  id: string;
  title: string;
  amount: number;
  paidById: string;
  date: string | Date;
  fundingSource?: string;
  status: string;
  category: string;
  paidBy?: {
    id: string;
    displayName: string;
    avatar?: string | null;
  };
  splits?: Array<{
    userId: string;
    amount: number;
    user?: {
      id: string;
      displayName: string;
      avatar?: string | null;
    };
  }>;
}

interface GroupFundSectionProps {
  groupId: string;
  groupName: string;
  currentUserId: string;
  isOwner: boolean;
  owner: {
    id: string;
    displayName: string;
    bankName: string | null;
    accountNumber: string | null;
    accountName: string | null;
  };
  fundContributions: FundContribution[];
  expenses: FundExpense[];
  members: Member[];
}

export function GroupFundSection({
  groupId,
  groupName,
  currentUserId,
  isOwner,
  owner,
  fundContributions = [],
  expenses = [],
  members = [],
}: GroupFundSectionProps) {
  const router = useRouter();
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [selectedContributionForQr, setSelectedContributionForQr] = useState<FundContribution | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // 1. Lọc các khoản chi từ quỹ đã được duyệt
  const fundExpenses = useMemo(() => {
    return (expenses || [])
      .filter((e) => e.fundingSource === "FUND" && e.status === "APPROVED")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses]);

  // 2. Tính toán tổng thu, tổng chi và số dư quỹ
  const totalContributed = useMemo(() => {
    return (fundContributions || [])
      .filter((c) => c.status === "CONFIRMED")
      .reduce((sum, c) => sum + (c.amount || 0), 0);
  }, [fundContributions]);

  const totalFundExpenses = useMemo(() => {
    return fundExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [fundExpenses]);

  const currentFundBalance = totalContributed - totalFundExpenses;

  // Xác nhận hoặc Từ chối khoản góp quỹ (dành cho Trưởng nhóm)
  async function handleUpdateStatus(id: string, status: "CONFIRMED" | "REJECTED") {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/fund-contributions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      setLoadingId(null);
      if (res.ok) {
        toast.success(
          status === "CONFIRMED"
            ? "Đã xác nhận khoản góp quỹ thành công!"
            : "Đã từ chối khoản góp quỹ!"
        );
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

  // Huỷ / Xoá khoản góp quỹ nháp
  async function handleDeleteContribution(id: string) {
    if (!confirm("Bạn có chắc chắn muốn xoá yêu cầu góp quỹ này?")) return;
    setLoadingId(id);
    try {
      const res = await fetch(`/api/fund-contributions/${id}`, {
        method: "DELETE",
      });

      setLoadingId(null);
      if (res.ok) {
        toast.success("Đã xoá yêu cầu góp quỹ!");
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
      {/* Thẻ hiển thị Số dư Quỹ chung của nhóm */}
      <Card
        className={`border-0 shadow-sm transition-all overflow-hidden ${
          currentFundBalance > 0
            ? "bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-card dark:from-amber-500/20 dark:via-amber-500/10"
            : currentFundBalance < 0
            ? "bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-card dark:from-rose-500/20 dark:via-rose-500/10"
            : "bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-card dark:from-blue-500/20"
        }`}
      >
        <CardContent className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Wallet className="h-5 w-5" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Số dư Quỹ nhóm hiện tại
                </span>
              </div>
              <p
                className={`text-3xl sm:text-4xl font-black tracking-tight font-mono ${
                  currentFundBalance > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : currentFundBalance < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-foreground"
                }`}
              >
                {formatVND(currentFundBalance)}
              </p>
              <p className="text-xs text-muted-foreground font-medium pt-0.5">
                {currentFundBalance > 0
                  ? "Quỹ đang dồi dào, sẵn sàng cho các hoạt động và hoá đơn chi chung 🎉"
                  : currentFundBalance < 0
                  ? "⚠️ Quỹ nhóm đang âm tiền, các thành viên vui lòng góp thêm quỹ!"
                  : "Quỹ hiện đang ở mức 0đ. Hãy bắt đầu đóng góp để tạo nguồn quỹ hoạt động!"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:self-center">
              <Button
                onClick={() => {
                  setSelectedContributionForQr(null);
                  setIsContributeOpen(true);
                }}
                size="lg"
                className="gap-2 font-bold shadow-md rounded-xl bg-amber-600 hover:bg-amber-700 text-white cursor-pointer h-11 px-5"
              >
                <Plus className="h-5 w-5" />
                <span>Góp quỹ ngay</span>
              </Button>
            </div>
          </div>

          {/* Cảnh báo nếu quỹ bị âm */}
          {currentFundBalance < 0 && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <p className="leading-relaxed">
                Số tiền chi tiêu đã vượt quá số tiền thành viên đóng góp. Vui lòng bấm <strong>"Góp quỹ ngay"</strong> để bổ sung tiền vào quỹ.
              </p>
            </div>
          )}

          {/* 3 Thống kê chi tiết */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
            <div className="p-3 rounded-xl bg-card/60 backdrop-blur-xs border border-border/60">
              <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                Tổng tiền đã nộp vào quỹ
              </p>
              <p className="text-base sm:text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                +{formatVND(totalContributed)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-card/60 backdrop-blur-xs border border-border/60">
              <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />
                Tổng tiền đã chi từ quỹ
              </p>
              <p className="text-base sm:text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                -{formatVND(totalFundExpenses)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-card/60 backdrop-blur-xs border border-border/60">
              <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                Người quản lý & giữ quỹ
              </p>
              <p className="text-sm font-bold text-foreground mt-0.5 truncate">
                {owner.displayName} {isOwner && "(Trưởng nhóm)"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Lịch sử Quỹ nhóm: Lịch sử Góp quỹ & Lịch sử Chi tiêu */}
      <Tabs defaultValue="contributions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-md h-9 p-1">
          <TabsTrigger value="contributions" className="gap-1.5 text-xs font-semibold">
            <Coins className="h-3.5 w-3.5" />
            Lịch sử nộp quỹ ({fundContributions.length})
          </TabsTrigger>
          <TabsTrigger value="expenses" className="gap-1.5 text-xs font-semibold">
            <Receipt className="h-3.5 w-3.5" />
            Lịch sử chi từ quỹ ({fundExpenses.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Lịch sử Góp quỹ */}
        <TabsContent value="contributions" className="space-y-3">
          {fundContributions.length === 0 ? (
            <Card className="border border-dashed shadow-sm">
              <CardContent className="py-12 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                  <Coins className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Chưa có ai nộp quỹ</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Các thành viên có thể bấm "Góp quỹ ngay" để chuyển tiền vào tài khoản Trưởng nhóm làm quỹ chung.
                  </p>
                </div>
                <Button
                  onClick={() => setIsContributeOpen(true)}
                  size="sm"
                  className="font-bold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Góp quỹ lần đầu
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {fundContributions.map((c) => {
                const contributor = members.find((m) => m.userId === c.userId)?.user || c.user;
                const isContributor = c.userId === currentUserId;
                const isPending = c.status === "PENDING";
                const isConfirmed = c.status === "CONFIRMED";
                const isRejected = c.status === "REJECTED";

                return (
                  <Card
                    key={c.id}
                    className="border bg-card hover:bg-accent/20 transition-colors shadow-xs"
                  >
                    <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10 border shrink-0">
                          <AvatarImage src={contributor?.avatar || undefined} />
                          <AvatarFallback className="text-xs font-bold">
                            {getInitials(contributor?.displayName)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground truncate">
                              {contributor?.displayName || "Thành viên"}
                            </span>
                            {isContributor && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                                Bạn
                              </Badge>
                            )}

                            {isConfirmed ? (
                              <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-semibold gap-1">
                                <Check className="h-3 w-3" /> Đã nhận tiền
                              </Badge>
                            ) : isPending ? (
                              <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 font-semibold gap-1">
                                <Clock className="h-3 w-3" /> Chờ Trưởng nhóm duyệt
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] bg-rose-500/10 text-rose-600 border border-rose-500/20 font-semibold gap-1">
                                <X className="h-3 w-3" /> Đã từ chối
                              </Badge>
                            )}
                          </div>

                          <p className="text-xs text-muted-foreground truncate">
                            {c.note || "Góp quỹ hoạt động"} • <span className="font-mono text-[11px]">{formatDate(c.createdAt)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/40">
                        <span className="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                          +{formatVND(c.amount)}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Trưởng nhóm duyệt hoặc từ chối */}
                          {isOwner && isPending && (
                            <>
                              <Button
                                size="sm"
                                disabled={loadingId === c.id}
                                onClick={() => handleUpdateStatus(c.id, "CONFIRMED")}
                                className="h-8 px-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                {loadingId === c.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    Đã nhận
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={loadingId === c.id}
                                onClick={() => handleUpdateStatus(c.id, "REJECTED")}
                                className="h-8 px-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-200"
                              >
                                Từ chối
                              </Button>
                            </>
                          )}

                          {/* Người nộp xem lại QR nếu chưa chuyển */}
                          {isPending && isContributor && !isOwner && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedContributionForQr(c);
                                setIsContributeOpen(true);
                              }}
                              className="h-8 px-2 text-xs font-semibold gap-1"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                              Mã QR
                            </Button>
                          )}

                          {/* Huỷ hoặc xoá nếu còn pending */}
                          {isPending && (isOwner || isContributor) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              disabled={loadingId === c.id}
                              onClick={() => handleDeleteContribution(c.id)}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              title="Xoá yêu cầu"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Lịch sử Chi tiêu từ Quỹ */}
        <TabsContent value="expenses" className="space-y-3">
          {fundExpenses.length === 0 ? (
            <Card className="border border-dashed shadow-sm">
              <CardContent className="py-12 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                  <Receipt className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Chưa có hoá đơn nào chi từ Quỹ nhóm</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Khi tạo hoá đơn mới, bạn có thể chọn nguồn tiền là "Chi từ Quỹ nhóm" để trích tiền từ quỹ chung thay vì chia tiền nợ cho các thành viên.
                  </p>
                </div>
                <Button asChild size="sm" className="font-bold">
                  <Link href={`/groups/${groupId}/expenses/new`}>
                    <Plus className="h-4 w-4 mr-1" />
                    Tạo hoá đơn chi từ quỹ
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {fundExpenses.map((expense) => {
                const payer = members.find((m) => m.userId === expense.paidById)?.user || expense.paidBy;
                const isPaidByOwner = expense.paidById === owner.id;
                const participantsCount = expense.splits?.length || 0;

                return (
                  <Card
                    key={expense.id}
                    className="border bg-card hover:bg-accent/20 transition-colors shadow-xs"
                  >
                    <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-foreground truncate">
                            {expense.title}
                          </h4>
                          <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] font-bold">
                            🏦 Chi từ Quỹ nhóm
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {expense.category || "Khác"}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>
                            Người chi: <strong className="text-foreground">{payer?.displayName || "Thành viên"}</strong>
                            {isPaidByOwner ? " (Rút từ quỹ)" : " (Đã ứng tiền túi)"}
                          </span>
                          <span>•</span>
                          <span>Người thụ hưởng ({participantsCount} người)</span>
                          <span>•</span>
                          <span className="font-mono text-[11px]">{formatDate(expense.date)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-0 pt-2 sm:pt-0">
                        <span className="text-base sm:text-lg font-black font-mono text-rose-600 dark:text-rose-400">
                          -{formatVND(expense.amount)}
                        </span>
                        <Button asChild variant="outline" size="sm" className="h-8 text-xs font-semibold">
                          <Link href={`/groups/${groupId}/expenses/${expense.id}`}>
                            Chi tiết
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Góp quỹ */}
      <FundContributionDialog
        isOpen={isContributeOpen}
        onOpenChange={(open) => {
          setIsContributeOpen(open);
          if (!open) setSelectedContributionForQr(null);
        }}
        groupId={groupId}
        groupName={groupName}
        owner={owner}
        isOwner={isOwner}
        initialContribution={selectedContributionForQr}
      />
    </div>
  );
}
