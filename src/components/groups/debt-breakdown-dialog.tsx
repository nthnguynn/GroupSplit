"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatVND, formatDate } from "@/lib/utils/format";
import { Receipt, CreditCard, ArrowRightLeft, Calculator, FileText, CheckCircle2, User, Coins, Clock, Loader2 } from "lucide-react";
import type { DebtEntry } from "@/lib/debt-calculator";

interface BreakdownExpense {
  id: string;
  title: string;
  amount: number;
  paidById: string;
  date: string;
  splits: Array<{
    userId: string;
    amount: number;
  }>;
  category?: string;
}

interface DebtBreakdownDialogProps {
  debt: DebtEntry | null;
  onClose: () => void;
  groupId: string;
  settlements?: Array<{
    id: string;
    fromUserId: string;
    fromUserName?: string;
    toUserId: string;
    toUserName?: string;
    amount: number;
    isConfirmed: boolean;
    createdAt: string;
    note?: string | null;
  }>;
  fundAllocations?: Array<{
    id: string;
    amount: number;
    note?: string | null;
    date: string;
    fromUserId: string;
    fromUserName?: string;
    toUserId: string;
    toUserName?: string;
  }>;
}

export function DebtBreakdownDialog({
  debt,
  onClose,
  groupId,
  settlements = [],
  fundAllocations = [],
}: DebtBreakdownDialogProps) {
  const [activeTab, setActiveTab] = useState<"PAYER" | "RECEIVER">("PAYER");
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Hoá đơn giữa 2 người chỉ được tải khi mở hộp thoại (không gửi sẵn toàn bộ hoá đơn nhóm)
  const pairKey = debt ? `${debt.fromUserId}:${debt.toUserId}` : null;
  const [loaded, setLoaded] = useState<{ key: string; expenses: BreakdownExpense[] } | null>(null);

  useEffect(() => {
    if (!pairKey) return;
    const [a, b] = pairKey.split(":");
    const controller = new AbortController();
    fetch(`/api/groups/${groupId}/debt-breakdown?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: BreakdownExpense[]) => setLoaded({ key: pairKey, expenses: data }))
      .catch((err) => {
        if (err?.name !== "AbortError") setLoaded({ key: pairKey, expenses: [] });
      });
    return () => controller.abort();
  }, [groupId, pairKey]);

  if (!debt) return null;

  const isLoading = loaded?.key !== pairKey;
  const expenses = isLoading ? [] : loaded!.expenses;

  const { fromUserId, fromUserName, toUserId, toUserName, amount } = debt;

  // Tìm lần thanh toán gần nhất giữa 2 bên (từ 2 phía đã xác nhận)
  const pairConfirmedSettlements = settlements
    .filter(
      (s) =>
        s.isConfirmed &&
        ((s.fromUserId === fromUserId && s.toUserId === toUserId) ||
          (s.fromUserId === toUserId && s.toUserId === fromUserId))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const lastSettlement = pairConfirmedSettlements[0] || null;
  const lastSettlementTime = lastSettlement ? new Date(lastSettlement.createdAt).getTime() : 0;

  // Lọc dữ liệu: Nếu showAllHistory = false, chỉ lấy các phát sinh TỪ SAU lần thanh toán gần nhất
  const activeExpenses = expenses.filter(
    (exp) =>
      showAllHistory ||
      lastSettlementTime === 0 ||
      new Date(exp.date).getTime() > lastSettlementTime
  );

  const activeFundAllocations = fundAllocations.filter(
    (fa) =>
      showAllHistory ||
      lastSettlementTime === 0 ||
      new Date(fa.date).getTime() > lastSettlementTime
  );

  const activeSettlements = settlements.filter(
    (s) =>
      showAllHistory ||
      lastSettlementTime === 0 ||
      new Date(s.createdAt).getTime() > lastSettlementTime
  );

  const isPayerTab = activeTab === "PAYER";

  // --- TÍNH TOÁN THEO CẶP GIAO DỊCH CHÍNH XÁC GIỮA (fromUserId - Người trả) VÀ (toUserId - Người nhận) ---

  // 1. Các khoản split mà fromUserId (Người trả) tiêu dùng từ các hóa đơn do toUserId (Người nhận) đứng ra trả
  const payerConsumedFromReceiver = activeExpenses
    .filter((exp) => exp.paidById === toUserId)
    .flatMap((exp) =>
      exp.splits
        .filter((s) => s.userId === fromUserId && s.amount > 0)
        .map((s) => ({
          expenseId: exp.id,
          title: exp.title,
          date: exp.date,
          category: exp.category,
          totalExpenseAmount: exp.amount,
          splitAmount: s.amount,
          paidById: exp.paidById,
        }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalPayerConsumedFromReceiver = payerConsumedFromReceiver.reduce(
    (sum, item) => sum + item.splitAmount,
    0
  );

  // 2. Các khoản split mà toUserId (Người nhận) tiêu dùng từ các hóa đơn do fromUserId (Người trả) đứng ra trả
  const receiverConsumedFromPayer = activeExpenses
    .filter((exp) => exp.paidById === fromUserId)
    .flatMap((exp) =>
      exp.splits
        .filter((s) => s.userId === toUserId && s.amount > 0)
        .map((s) => ({
          expenseId: exp.id,
          title: exp.title,
          date: exp.date,
          category: exp.category,
          totalExpenseAmount: exp.amount,
          splitAmount: s.amount,
          paidById: exp.paidById,
        }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalReceiverConsumedFromPayer = receiverConsumedFromPayer.reduce(
    (sum, item) => sum + item.splitAmount,
    0
  );

  // 3. Tiền Quỹ nhóm giao dịch giữa 2 bên
  const pairFundAllocations = activeFundAllocations.filter(
    (fa) =>
      (fa.fromUserId === toUserId && fa.toUserId === fromUserId) ||
      (fa.fromUserId === fromUserId && fa.toUserId === toUserId)
  );

  const fundGivenReceiverToPayer = pairFundAllocations
    .filter((fa) => fa.fromUserId === toUserId && fa.toUserId === fromUserId)
    .reduce((sum, fa) => sum + fa.amount, 0);

  const fundGivenPayerToReceiver = pairFundAllocations
    .filter((fa) => fa.fromUserId === fromUserId && fa.toUserId === toUserId)
    .reduce((sum, fa) => sum + fa.amount, 0);

  const netPairFund = fundGivenReceiverToPayer - fundGivenPayerToReceiver;

  // 4. Lịch sử chuyển trả trực tiếp đã xác nhận giữa 2 bên
  const pairSettlementsList = activeSettlements.filter(
    (s) =>
      s.isConfirmed &&
      ((s.fromUserId === fromUserId && s.toUserId === toUserId) ||
        (s.fromUserId === toUserId && s.toUserId === fromUserId))
  );

  const settlementPaidPayerToReceiver = pairSettlementsList
    .filter((s) => s.fromUserId === fromUserId && s.toUserId === toUserId)
    .reduce((sum, s) => sum + s.amount, 0);

  const settlementPaidReceiverToPayer = pairSettlementsList
    .filter((s) => s.fromUserId === toUserId && s.toUserId === fromUserId)
    .reduce((sum, s) => sum + s.amount, 0);

  const netPairSettlement = settlementPaidPayerToReceiver - settlementPaidReceiverToPayer;

  // --- TÍNH TOÁN SỐ DƯ RÒNG TUYỆT ĐỐI KHỚP NGUYÊN BẢN CÁC MỤC 1 + 2 + 3 + 4 ---
  
  // SỐ DƯ RÒNG DÀNH CHO PAYER (fromUserId):
  // payerNetBalance = (- Tiền tiêu dùng từ HĐ do Receiver trả) + (+ Tiền ứng trước cho Receiver tiêu dùng) + (+ Tiền Quỹ nhận được) + (+ Tiền đã chuyển trả)
  const payerNetBalance =
    -totalPayerConsumedFromReceiver +
    totalReceiverConsumedFromPayer +
    netPairFund +
    netPairSettlement;

  // SỐ DƯ RÒNG DÀNH CHO RECEIVER (toUserId):
  // receiverNetBalance = (+ Tiền ứng trả hộ Payer) - (- Tiền tiêu dùng từ HĐ do Payer trả) - (- Tiền Quỹ đã cấp) - (- Tiền đã nhận thanh toán)
  const receiverNetBalance = -payerNetBalance;

  // Chọn số dư ròng theo Tab đang mở
  const currentNetBalance = isPayerTab ? payerNetBalance : receiverNetBalance;
  const currentDisplayAmount = Math.abs(currentNetBalance);

  // Helper hiển thị dấu chuẩn (+ / -) không bao giờ bị thừa hoặc lặp dấu
  const formatSignedAmount = (val: number, positiveSign: string = "+", negativeSign: string = "") => {
    if (val === 0) return "0 ₫";
    if (val > 0) return `${positiveSign}${formatVND(val)}`;
    return `${negativeSign}${formatVND(val)}`;
  };

  return (
    <Dialog open={!!debt} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider mb-1">
            <FileText className="h-4 w-4" />
            Bảng kê chi tiết hạch toán dư nợ
          </div>
          <DialogTitle className="text-lg font-bold flex items-center justify-between gap-2">
            <span>
              {fromUserName} <span className="text-muted-foreground font-normal">➔</span> {toUserName}
            </span>
            <Badge variant="destructive" className="text-sm font-extrabold px-3 py-1 shrink-0">
              {formatVND(isLoading ? amount : currentDisplayAmount)}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            Chi tiết các khoản phát sinh dư nợ đối soát trực tiếp giữa {fromUserName} và {toUserName}.
          </DialogDescription>

          {/* Alert / Filter Status Bar */}
          <div className="flex items-center justify-between bg-card border p-2 px-3 rounded-lg text-xs mt-3">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              {!showAllHistory && lastSettlement ? (
                <span>
                  Phát sinh từ lần thanh toán gần nhất (<strong>{formatDate(new Date(lastSettlement.createdAt))}</strong>)
                </span>
              ) : (
                <span>Hiển thị tất cả lịch sử phát sinh</span>
              )}
            </span>
            {lastSettlement && (
              <button
                type="button"
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="text-[11px] font-bold text-primary hover:underline cursor-pointer ml-2 shrink-0"
              >
                {showAllHistory ? "Chỉ xem chưa thanh toán" : "Xem tất cả lịch sử"}
              </button>
            )}
          </div>

          {/* Toggle Tab between Payer & Receiver */}
          <div className="flex p-1 bg-muted rounded-lg mt-3 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("PAYER")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer select-none ${
                isPayerTab
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="h-3.5 w-3.5 text-rose-500" />
              Chi tiết: {fromUserName} (Người trả)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("RECEIVER")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer select-none ${
                !isPayerTab
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <User className="h-3.5 w-3.5 text-emerald-500" />
              Chi tiết: {toUserName} (Người nhận)
            </button>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
          <>
          {/* Tổng dư nợ Card */}
          <Card className="bg-primary/5 dark:bg-primary/10 border-primary/20">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-primary mb-1">
                <span className="flex items-center gap-1.5">
                  <Calculator className="h-4 w-4" />
                  {isPayerTab ? `Tổng dư nợ (${fromUserName})` : `Quyền lợi thu nợ (${toUserName})`}
                </span>
                {!showAllHistory && lastSettlement ? (
                  <Badge variant="outline" className="text-[10px] font-normal">Chưa thanh toán</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] font-normal">Tất cả lịch sử</Badge>
                )}
              </div>

              {isPayerTab ? (
                /* VIEW FOR PAYER (fromUserName) */
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">1. Tiền cá nhân tiêu dùng (HĐ do {toUserName} trả):</span>
                    <span className="font-semibold text-rose-500">
                      {totalPayerConsumedFromReceiver > 0 ? `-${formatVND(totalPayerConsumedFromReceiver)}` : "0 ₫"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">2. Tiền ứng trước cho {toUserName} tiêu dùng:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {totalReceiverConsumedFromPayer > 0 ? `+${formatVND(totalReceiverConsumedFromPayer)}` : "0 ₫"}
                    </span>
                  </div>
                  {pairFundAllocations.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">3. Tiền Quỹ nhận từ / Cấp cho {toUserName}:</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {formatSignedAmount(netPairFund)}
                      </span>
                    </div>
                  )}
                  {pairSettlementsList.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        {pairFundAllocations.length > 0 ? "4. Đã chuyển trả cho " : "3. Đã chuyển trả cho "}{toUserName}:
                      </span>
                      <span className="font-semibold text-blue-500">
                        {formatSignedAmount(netPairSettlement)}
                      </span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center font-bold text-sm">
                    <span>
                      {payerNetBalance < 0
                        ? `Khoản nợ chốt phải trả cho ${toUserName}:`
                        : payerNetBalance > 0
                        ? `Khoản sẽ nhận lại từ ${toUserName}:`
                        : `Đã thanh toán sòng phẳng (Dư nợ = 0 ₫)`}
                    </span>
                    {payerNetBalance !== 0 && (
                      <span className={payerNetBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {formatVND(currentDisplayAmount)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                /* VIEW FOR RECEIVER (toUserName) */
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">1. Tiền đã ứng trả hộ {fromUserName}:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {totalPayerConsumedFromReceiver > 0 ? `+${formatVND(totalPayerConsumedFromReceiver)}` : "0 ₫"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">2. Tiền tiêu dùng từ HĐ do {fromUserName} trả:</span>
                    <span className="font-semibold text-rose-500">
                      {totalReceiverConsumedFromPayer > 0 ? `-${formatVND(totalReceiverConsumedFromPayer)}` : "0 ₫"}
                    </span>
                  </div>
                  {pairFundAllocations.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">3. Tiền Quỹ cấp cho / Nhận từ {fromUserName}:</span>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        {formatSignedAmount(-netPairFund)}
                      </span>
                    </div>
                  )}
                  {pairSettlementsList.length > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">
                        {pairFundAllocations.length > 0 ? "4. Đã nhận thanh toán từ " : "3. Đã nhận thanh toán từ "}{fromUserName}:
                      </span>
                      <span className="font-semibold text-blue-500">
                        {formatSignedAmount(-netPairSettlement)}
                      </span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between items-center font-bold text-sm">
                    <span>
                      {receiverNetBalance > 0
                        ? `Khoản sẽ nhận lại từ ${fromUserName}:`
                        : receiverNetBalance < 0
                        ? `Khoản nợ chốt phải trả cho ${fromUserName}:`
                        : `Đã thanh toán sòng phẳng (Dư nợ = 0 ₫)`}
                    </span>
                    {receiverNetBalance !== 0 && (
                      <span className={receiverNetBalance > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {formatVND(currentDisplayAmount)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 1: Hóa đơn tham gia chia tiền */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <Receipt className="h-4 w-4 text-rose-500" />
                {isPayerTab
                  ? `1. Hóa đơn ${fromUserName} tham gia chia tiền do ${toUserName} trả (${payerConsumedFromReceiver.length})`
                  : `1. Hóa đơn ${toUserName} ứng trả hộ cho ${fromUserName} (${payerConsumedFromReceiver.length})`}
              </h4>
              <span className="text-xs font-semibold text-rose-500">
                {isPayerTab ? `Tổn thất: -${formatVND(totalPayerConsumedFromReceiver)}` : `Đã ứng hộ: +${formatVND(totalPayerConsumedFromReceiver)}`}
              </span>
            </div>

            {payerConsumedFromReceiver.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded-lg text-center">
                Không có hóa đơn chia tiền nào.
              </p>
            ) : (
              <div className="space-y-2">
                {payerConsumedFromReceiver.map((item, idx) => (
                  <div
                    key={`${item.expenseId}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs hover:bg-accent/40 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDate(new Date(item.date))} • Tổng HĐ: {formatVND(item.totalExpenseAmount)} (Do {toUserName} trả)
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-rose-500">-{formatVND(item.splitAmount)}</p>
                      <span className="text-[10px] text-muted-foreground">Phần {fromUserName} nợ</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Hóa đơn ứng tiền trước */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                {isPayerTab
                  ? `2. Hóa đơn ${fromUserName} tự ứng trả cho ${toUserName} (${receiverConsumedFromPayer.length})`
                  : `2. Hóa đơn ${toUserName} tham gia chia tiền do ${fromUserName} trả (${receiverConsumedFromPayer.length})`}
              </h4>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {isPayerTab ? `Đã chi: +${formatVND(totalReceiverConsumedFromPayer)}` : `Tổn thất: -${formatVND(totalReceiverConsumedFromPayer)}`}
              </span>
            </div>

            {receiverConsumedFromPayer.length === 0 ? (
              <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded-lg text-center">
                Không có hóa đơn đứng ra trả tiền nào.
              </p>
            ) : (
              <div className="space-y-2">
                {receiverConsumedFromPayer.map((exp, idx) => (
                  <div
                    key={`${exp.expenseId}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs hover:bg-accent/40 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-foreground truncate">{exp.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDate(new Date(exp.date))} • Do {fromUserName} trả
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">+{formatVND(exp.splitAmount)}</p>
                      <span className="text-[10px] text-muted-foreground">Phần {toUserName} nợ lại</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Tiền cấp từ Quỹ nhóm */}
          {pairFundAllocations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  <Coins className="h-4 w-4 text-purple-500" />
                  3. Tiền cấp từ Quỹ nhóm trực tiếp ({pairFundAllocations.length})
                </h4>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                  {formatSignedAmount(netPairFund)}
                </span>
              </div>
              <div className="space-y-2">
                {pairFundAllocations.map((fa) => {
                  const isRecipient = fa.toUserId === (isPayerTab ? fromUserId : toUserId);
                  return (
                    <div
                      key={fa.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-purple-500 shrink-0" />
                        <div>
                          <p className="font-semibold">
                            {isRecipient ? "Được cấp tiền từ Quỹ" : "Đã phát tiền Quỹ cho"}{" "}
                            <span className="text-primary font-bold">
                              {isRecipient ? (fa.fromUserName || "Quản lý quỹ") : (fa.toUserName || "Thành viên")}
                            </span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(new Date(fa.date))} {fa.note ? `• ${fa.note}` : ""}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`font-bold ${
                          isRecipient ? "text-purple-600 dark:text-purple-400" : "text-rose-500"
                        }`}
                      >
                        {isRecipient ? "+" : "-"}{formatVND(fa.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Lịch sử thanh toán bù nợ */}
          {pairSettlementsList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
                  <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                  {pairFundAllocations.length > 0 ? "4" : "3"}. Lịch sử thanh toán bù nợ trực tiếp ({pairSettlementsList.length})
                </h4>
              </div>
              <div className="space-y-2">
                {pairSettlementsList.map((s) => {
                  const isPayer = s.fromUserId === (isPayerTab ? fromUserId : toUserId);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        <div>
                          <p className="font-semibold">
                            {isPayer ? "Đã chuyển trả" : "Đã nhận tiền từ"}{" "}
                            <span className="text-primary font-bold">
                              {isPayer ? s.toUserName : s.fromUserName}
                            </span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(new Date(s.createdAt))}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`font-bold ${
                          isPayer ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                        }`}
                      >
                        {isPayer ? "+" : "-"}{formatVND(s.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
