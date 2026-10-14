"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight, Clock, Banknote, FileText } from "lucide-react";
import { PayDialog } from "./pay-dialog";
import { DebtBreakdownDialog } from "./debt-breakdown-dialog";
import { formatVND, getInitials } from "@/lib/utils/format";

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

interface DebtEntry {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

interface GroupBalanceSummaryProps {
  myBalance: {
    userId: string;
    balance: number;
  };
  myDebts: DebtEntry[];
  myClaims?: DebtEntry[];
  members: Member[];
  groupId: string;
  currentUserId: string;
  settlements: any[];
  fundAllocations?: any[];
}

export function GroupBalanceSummary({
  myBalance,
  myDebts,
  myClaims = [],
  members,
  groupId,
  currentUserId,
  settlements,
  fundAllocations = [],
}: GroupBalanceSummaryProps) {
  const [activeDebt, setActiveDebt] = useState<DebtEntry | null>(null);
  const [breakdownDebt, setBreakdownDebt] = useState<DebtEntry | null>(null);

  // Filter settlements to check if there is a pending settlement for a specific debt key
  const hasPendingSettlement = (debt: DebtEntry) => {
    return settlements.some(
      (s) =>
        s.fromUserId === debt.fromUserId &&
        s.toUserId === debt.toUserId &&
        !s.isConfirmed &&
        !(s.note?.startsWith("[QR_PENDING]") && !s.isConfirmed)
    );
  };

  return (
    <div className="space-y-4">
      <Card
        className={`border-0 shadow-sm transition-all overflow-hidden ${
          myBalance.balance > 0
            ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 dark:from-emerald-500/20 dark:to-emerald-500/10"
            : myBalance.balance < 0
            ? "bg-gradient-to-br from-rose-500/10 to-rose-500/5 dark:from-rose-500/20 dark:to-rose-500/10"
            : "bg-gradient-to-br from-blue-500/10 to-blue-500/5 dark:from-blue-500/20 dark:to-blue-500/10"
        }`}
      >
        <CardContent className="p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Số dư của bạn trong nhóm này</p>
              <p
                className={`text-3xl font-black tracking-tight mt-1 ${
                  myBalance.balance > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : myBalance.balance < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-blue-600 dark:text-blue-400"
                }`}
              >
                {myBalance.balance > 0 ? "+" : ""}
                {formatVND(myBalance.balance)}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-semibold">
                {myBalance.balance > 0
                  ? "Bạn đang được nhận lại tiền"
                  : myBalance.balance < 0
                  ? "Bạn đang có các khoản nợ cần trả"
                  : "Hạch toán sạch! Không nợ ai và không ai nợ bạn 🎉"}
              </p>
            </div>
          </div>

          {/* List of claims to receive */}
          {myClaims.length > 0 && (
            <div className="pt-4 border-t border-border/40 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Các khoản bạn sẽ nhận lại:
              </p>
              <div className="space-y-2">
                {myClaims.map((debt) => {
                  const key = `${debt.fromUserId}-${debt.toUserId}`;
                  const fromMember = members.find((m) => m.userId === debt.fromUserId);
                  const toMember = members.find((m) => m.userId === debt.toUserId);
                  const fromAvatar = fromMember?.user.avatar;
                  const toAvatar = toMember?.user.avatar;

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card/40 backdrop-blur-xs border border-border/50 text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar className="h-7 w-7 shrink-0 border">
                          {fromAvatar && (
                            <AvatarImage src={fromAvatar} alt={debt.fromUserName} className="object-cover" />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {getInitials(debt.fromUserName)}
                          </AvatarFallback>
                        </Avatar>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Avatar className="h-7 w-7 shrink-0 border">
                          {toAvatar && (
                            <AvatarImage src={toAvatar} alt={debt.toUserName} className="object-cover" />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {getInitials(debt.toUserName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            <span className="text-foreground font-bold">{debt.fromUserName}</span> sẽ trả cho Bạn
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 font-bold">
                            Số tiền: {formatVND(debt.amount)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setBreakdownDebt(debt)}
                          className="h-7 px-2 text-[10px] font-semibold gap-1 text-muted-foreground hover:text-foreground"
                          title="Xem chi tiết các hóa đơn cấu thành khoản tiền này"
                        >
                          <FileText className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Chi tiết</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* List of user's own debts to settle */}
          {myDebts.length > 0 && (
            <div className="pt-4 border-t border-border/40 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Các khoản bạn cần thanh toán:
              </p>
              <div className="space-y-2">
                {myDebts.map((debt) => {
                  const key = `${debt.fromUserId}-${debt.toUserId}`;
                  const pending = hasPendingSettlement(debt);
                  const fromMember = members.find((m) => m.userId === debt.fromUserId);
                  const toMember = members.find((m) => m.userId === debt.toUserId);
                  const fromAvatar = fromMember?.user.avatar;
                  const toAvatar = toMember?.user.avatar;

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card/40 backdrop-blur-xs border border-border/50 text-xs shadow-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Avatar className="h-7 w-7 shrink-0 border">
                          {fromAvatar && (
                            <AvatarImage src={fromAvatar} alt={debt.fromUserName} className="object-cover" />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {getInitials(debt.fromUserName)}
                          </AvatarFallback>
                        </Avatar>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Avatar className="h-7 w-7 shrink-0 border">
                          {toAvatar && (
                            <AvatarImage src={toAvatar} alt={debt.toUserName} className="object-cover" />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {getInitials(debt.toUserName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            Trả cho <span className="text-foreground font-bold">{debt.toUserName}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            Số tiền: {formatVND(debt.amount)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setBreakdownDebt(debt)}
                          className="h-7 px-2 text-[10px] font-semibold gap-1 text-muted-foreground hover:text-foreground"
                          title="Xem chi tiết các hóa đơn cấu thành khoản nợ"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Chi tiết</span>
                        </Button>

                        {pending ? (
                          <Badge
                            variant="outline"
                            className="gap-1 font-bold text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 h-7 opacity-100"
                          >
                            <Clock className="h-3 w-3 animate-pulse" />
                            Đã chuyển (Chờ duyệt)
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => setActiveDebt(debt)}
                            className="gap-1 font-bold text-[10px] h-7 px-3 cursor-pointer"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            Trả nợ
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Render reusable PayDialog */}
      <PayDialog
        debt={activeDebt}
        onClose={() => setActiveDebt(null)}
        groupId={groupId}
        members={members}
        currentUserId={currentUserId}
      />

      {/* Render reusable DebtBreakdownDialog */}
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
