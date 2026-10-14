"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatVND } from "@/lib/utils/format";
import {
  Coins,
  QrCode,
  Copy,
  Check,
  Loader2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Building2,
} from "lucide-react";

interface OwnerBankInfo {
  id: string;
  displayName: string;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

interface FundContributionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  owner: OwnerBankInfo;
  isOwner: boolean;
  initialContribution?: {
    id: string;
    amount: number;
    note: string | null;
  } | null;
}

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000];

export function FundContributionDialog({
  isOpen,
  onOpenChange,
  groupId,
  groupName,
  owner,
  isOwner,
  initialContribution = null,
}: FundContributionDialogProps) {
  const router = useRouter();
  const [amount, setAmount] = useState<string>("100000");
  const [note, setNote] = useState<string>("Góp quỹ nhóm");
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Active contribution for QR step
  const [activeContribution, setActiveContribution] = useState<{
    id: string;
    amount: number;
    note: string | null;
  } | null>(initialContribution);

  useEffect(() => {
    if (initialContribution) {
      setActiveContribution(initialContribution);
    } else {
      setActiveContribution(null);
      setAmount("100000");
      setNote("Góp quỹ nhóm");
    }
  }, [initialContribution, isOpen]);

  const parsedAmount = parseFloat(amount) || 0;

  async function handleCopy(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success(`Đã sao chép ${field}!`);
    setTimeout(() => setCopiedField(null), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedAmount <= 0) {
      toast.error("Vui lòng nhập số tiền góp quỹ hợp lệ");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/fund-contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          note: note.trim() || "Góp quỹ nhóm",
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        toast.error(data.error || "Góp quỹ thất bại");
        return;
      }

      if (isOwner) {
        toast.success("Trưởng nhóm tự nộp quỹ: Đã ghi nhận vào Quỹ nhóm thành công!");
        onOpenChange(false);
        router.refresh();
      } else {
        // Chuyển sang bước quét QR cho thành viên
        setActiveContribution(data);
        toast.success("Đã tạo yêu cầu góp quỹ! Vui lòng quét mã QR chuyển khoản cho Trưởng nhóm.");
        router.refresh();
      }
    } catch (err) {
      setLoading(false);
      console.error(err);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  const qrImageUrl =
    activeContribution && owner.bankName && owner.accountNumber
      ? `https://img.vietqr.io/image/${owner.bankName}-${owner.accountNumber}-compact2.png?amount=${activeContribution.amount}&addInfo=GQ${activeContribution.id}&accountName=${encodeURIComponent(
          owner.accountName || ""
        )}`
      : null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Coins className="h-5 w-5 text-amber-500" />
            {activeContribution ? "Quét mã VietQR Góp quỹ" : "Góp quỹ hoạt động nhóm"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {activeContribution
              ? "Chuyển tiền vào tài khoản Trưởng nhóm để hoàn tất góp quỹ"
              : `Đóng góp tiền vào Quỹ chung của nhóm "${groupName}"`}
          </DialogDescription>
        </DialogHeader>

        {!activeContribution ? (
          /* Step 1: Nhập số tiền & ghi chú */
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-xs font-semibold">
                Số tiền góp quỹ (VND) <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  step="1000"
                  min="1000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Nhập số tiền..."
                  className="font-mono text-base font-bold pl-3 pr-12 h-11"
                  required
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                  đ
                </span>
              </div>

              {/* Quick amount pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK_AMOUNTS.map((amt) => (
                  <Button
                    key={amt}
                    type="button"
                    variant={parsedAmount === amt ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAmount(String(amt))}
                    className="h-7 text-xs font-mono"
                  >
                    {formatVND(amt)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note" className="text-xs font-semibold">
                Ghi chú / Nội dung
              </Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Góp quỹ tháng này..."
                className="h-10 text-xs"
              />
            </div>

            {/* Thông tin người nhận */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
              <p className="font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Người giữ Quỹ nhóm: {owner.displayName} {isOwner && "(Chính bạn)"}
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {isOwner
                  ? "Bạn là Trưởng nhóm đang giữ quỹ, số tiền sẽ được tự động ghi nhận vào quỹ chung ngay sau khi xác nhận."
                  : "Sau khi gửi yêu cầu, hệ thống sẽ cung cấp mã QR chuyển khoản cho Trưởng nhóm. Quỹ sẽ tăng sau khi Trưởng nhóm xác nhận hoặc SePay khớp tự động."}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                disabled={loading}
              >
                Huỷ
              </Button>
              <Button
                type="submit"
                disabled={loading || parsedAmount <= 0}
                className="flex-1 font-bold bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Đang tạo...
                  </>
                ) : isOwner ? (
                  "Xác nhận nộp quỹ"
                ) : (
                  <>
                    Tiếp tục quét QR
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          /* Step 2: Quét mã QR chuyển khoản */
          <div className="space-y-4 pt-1">
            {qrImageUrl ? (
              <div className="flex flex-col items-center">
                <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-border">
                  <img
                    src={qrImageUrl}
                    alt="VietQR Chuyển khoản"
                    className="w-56 h-56 object-contain"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  Mở ứng dụng Ngân hàng và quét mã VietQR để thanh toán chuẩn xác
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Trưởng nhóm chưa cập nhật tài khoản ngân hàng</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Vui lòng liên hệ Trưởng nhóm ({owner.displayName}) cập nhật STK trong Cài đặt hoặc chuyển khoản trực tiếp bên ngoài.
                  </p>
                </div>
              </div>
            )}

            {/* Chi tiết chuyển khoản */}
            <div className="space-y-2 p-3.5 rounded-xl bg-muted/60 border text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Số tiền góp quỹ:</span>
                <span className="font-bold font-mono text-sm text-amber-600 dark:text-amber-400">
                  {formatVND(activeContribution.amount)}
                </span>
              </div>

              {owner.bankName && (
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Ngân hàng:</span>
                  <span className="font-semibold">{owner.bankName}</span>
                </div>
              )}

              {owner.accountNumber && (
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Số tài khoản:</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold">
                    <span>{owner.accountNumber}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopy(owner.accountNumber!, "số tài khoản")}
                    >
                      {copiedField === "số tài khoản" ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {owner.accountName && (
                <div className="flex items-center justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Tên người nhận:</span>
                  <span className="font-semibold uppercase">{owner.accountName}</span>
                </div>
              )}

              <div className="flex items-center justify-between py-1 bg-amber-500/10 px-2 rounded-lg -mx-1">
                <div className="flex flex-col">
                  <span className="font-bold text-amber-700 dark:text-amber-300">Nội dung chuyển khoản:</span>
                  <span className="text-[10px] text-muted-foreground">(Giữ nguyên để khớp tự động)</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                  <span>GQ{activeContribution.id}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-amber-500/20"
                    onClick={() => handleCopy(`GQ${activeContribution.id}`, "nội dung")}
                  >
                    {copiedField === "nội dung" ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="default"
                onClick={() => {
                  onOpenChange(false);
                  toast.info("Yêu cầu góp quỹ đã được lưu lại. Hệ thống sẽ cập nhật ngay khi Trưởng nhóm xác nhận.");
                  router.refresh();
                }}
                className="w-full font-bold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                Tôi đã chuyển khoản xong
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
