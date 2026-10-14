"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatVND } from "@/lib/utils/format";
import { Loader2, ArrowRight, Clock, Banknote, HelpCircle, Copy, Check, QrCode } from "lucide-react";

interface Member {
  userId: string;
  user: {
    id: string;
    displayName: string;
    bankName: string | null;
    accountNumber: string | null;
    accountName: string | null;
    hasSepay: boolean;
  };
}

interface DebtEntry {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

interface PayDialogProps {
  debt: DebtEntry | null;
  onClose: () => void;
  groupId: string;
  members: Member[];
  currentUserId: string;
}

export function PayDialog({
  debt,
  onClose,
  groupId,
  members,
  currentUserId,
}: PayDialogProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Trạng thái thanh toán tự động bằng QR đang chờ quét
  const [activePayment, setActivePayment] = useState<{
    id: string;
    amount: number;
    recipientId: string;
  } | null>(null);

  // Đánh dấu không xóa Settlement khi đóng Dialog (nếu đã click Tôi đã chuyển xong hoặc đã thanh toán thành công)
  const keepSettlement = useRef(false);

  const recipientUser = debt
    ? members.find((m) => m.userId === debt.toUserId)?.user
    : null;

  const recipientHasBankInfo =
    recipientUser?.bankName &&
    recipientUser?.accountNumber &&
    recipientUser?.accountName;

  // Sao chép thông tin thủ công
  const copyText = async (text: string, fieldName: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Đã sao chép ${fieldName}!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // 1. Thanh toán bằng QR chuyển khoản
  async function payWithQR() {
    if (!debt || !recipientUser) return;
    const key = `${debt.fromUserId}-${debt.toUserId}`;
    setLoadingId(key);

    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUserId: debt.fromUserId,
          toUserId: debt.toUserId,
          amount: debt.amount,
          note: `[QR_PENDING] Đã chuyển tiền cho ${recipientUser.displayName}`,
        }),
      });

      const data = await res.json();
      setLoadingId(null);

      if (res.ok && data.id) {
        const currentAmount = debt.amount;
        const recipientId = debt.toUserId;
        // Kích hoạt hiển thị QR và chuyển đổi trạng thái dialog
        setActivePayment({
          id: data.id,
          amount: currentAmount,
          recipientId,
        });
      } else {
        toast.error(data.error || "Không thể tạo yêu cầu thanh toán");
      }
    } catch (err) {
      setLoadingId(null);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  // 2. Thanh toán bằng tiền mặt / chuyển khoản thủ công
  async function payWithCash() {
    if (!debt) return;
    const key = `${debt.fromUserId}-${debt.toUserId}`;
    setLoadingId(key);

    try {
      const res = await fetch(`/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromUserId: debt.fromUserId,
          toUserId: debt.toUserId,
          amount: debt.amount,
          note: "Thanh toán bằng tiền mặt / CK thủ công",
        }),
      });

      setLoadingId(null);
      onClose();

      if (res.ok) {
        toast.success("Đã ghi nhận yêu cầu trả tiền! Vui lòng chờ người nhận xác nhận.");
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

  // 3. Xác nhận chuyển khoản thủ công (Xoá nhãn QR_PENDING)
  async function confirmManualTransfer() {
    if (!activePayment) return;
    setLoadingId("manual-confirm");

    try {
      const res = await fetch(`/api/settlements/${activePayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: `Đã chuyển tiền cho ${recipientUser?.displayName}`,
        }),
      });

      setLoadingId(null);

      if (res.ok) {
        keepSettlement.current = true;
        setActivePayment(null);
        onClose();
        toast.success("Đã chuyển tiền thành công! Đang chờ người nhận xác nhận.");
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

  // Hủy giao dịch nháp khi tắt QR mà không hoàn tất
  async function cancelPayment(settlementId: string) {
    try {
      await fetch(`/api/settlements/${settlementId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Lỗi khi hủy giao dịch nháp:", err);
    }
  }

  // Poll kiểm tra trạng thái thanh toán từ SePay Webhook
  useEffect(() => {
    if (!activePayment) return;

    const paymentId = activePayment.id;
    let timer: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 100; // ~5 phút

    async function checkStatus() {
      if (attempts >= maxAttempts) {
        setActivePayment(null);
        toast.warning("Hết thời gian chờ thanh toán tự động. Vui lòng liên hệ người nhận để duyệt thủ công.");
        router.refresh();
        return;
      }

      attempts++;
      try {
        const res = await fetch(`/api/settlements/${paymentId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.isConfirmed) {
            keepSettlement.current = true;
            setActivePayment(null);
            onClose();
            toast.success("Đã chuyển và nhận tiền thành công! Giao dịch của bạn đã được xác nhận tự động. 🎉");
            router.refresh();
            return;
          }
        }
      } catch (err) {
        console.error("Lỗi kiểm tra trạng thái:", err);
      }

      timer = setTimeout(checkStatus, 3000);
    }

    timer = setTimeout(checkStatus, 3000);

    return () => clearTimeout(timer);
  }, [activePayment, router, onClose]);

  // Tạo QR URL hướng tới tài khoản người thụ hưởng (recipientUser)
  const qrUrl =
    activePayment && recipientUser && recipientUser.accountNumber && recipientUser.bankName
      ? `https://vietqr.app/img?acc=${recipientUser.accountNumber}&bank=${recipientUser.bankName}&amount=${activePayment.amount}&des=GS${activePayment.id}`
      : "";

  const transferContent = activePayment ? `GS${activePayment.id}` : "";

  return (
    <>
      {/* 1. Dialog Lựa chọn hình thức thanh toán */}
      <Dialog
        open={debt !== null && activePayment === null}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-lg">Chọn hình thức trả nợ</DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Bạn đang thực hiện trả nợ cho **{debt?.toUserName}** số tiền **{debt ? formatVND(debt.amount) : "0"}**
            </DialogDescription>
          </DialogHeader>

          {debt && (
            <div className="space-y-3 pt-2">
              {recipientHasBankInfo ? (
                <Button
                  onClick={payWithQR}
                  disabled={loadingId === `${debt.fromUserId}-${debt.toUserId}`}
                  className="w-full h-12 flex justify-start gap-3 items-center px-4 font-semibold"
                >
                  {loadingId === `${debt.fromUserId}-${debt.toUserId}` ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
                  ) : (
                    <QrCode className="h-5 w-5 text-primary-foreground" />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-bold">Chuyển khoản bằng mã VietQR</p>
                    <p className="text-[10px] opacity-80 font-normal">Quét QR chuyển khoản tự động duyệt nợ</p>
                  </div>
                </Button>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-2 items-start text-xs text-amber-700 dark:text-amber-500">
                  <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Người nhận (**{debt.toUserName}**) chưa cấu hình thông tin tài khoản ngân hàng trong Cài đặt nên không thể tạo mã chuyển khoản VietQR tự động.
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={payWithCash}
                className="w-full h-12 flex justify-start gap-3 items-center px-4 border-dashed font-semibold cursor-pointer"
              >
                <Banknote className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <p className="text-sm font-bold text-foreground">Trả bằng Tiền mặt / CK tay</p>
                  <p className="text-[10px] text-muted-foreground font-normal">Xác nhận đã đưa tiền mặt, người nhận duyệt thủ công</p>
                </div>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 2. Dialog Quét mã VietQR thanh toán tự động */}
      <Dialog
        open={activePayment !== null}
        onOpenChange={(open) => {
          if (!open) {
            if (activePayment && !keepSettlement.current) {
              cancelPayment(activePayment.id);
            }
            keepSettlement.current = false;
            setActivePayment(null);
            onClose();
          }
        }}
      >
        <DialogContent className="max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-center font-bold text-lg">Quét QR chuyển khoản</DialogTitle>
            <DialogDescription className="text-center text-xs text-muted-foreground">
              Mở ứng dụng ngân hàng và quét mã để chuyển khoản chính xác thông tin.
            </DialogDescription>
          </DialogHeader>

          {activePayment && recipientUser && (
            <div className="space-y-4">
              <div className="flex justify-center p-3 border rounded-2xl bg-white max-w-[220px] mx-auto shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="VietQR Code" className="w-full aspect-square" />
              </div>

              {/* Thông tin chi tiết */}
              <div className="bg-muted/50 rounded-2xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Ngân hàng nhận</span>
                  <div className="flex items-center gap-1 font-semibold">
                    <span>{recipientUser.bankName}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 cursor-pointer"
                      onClick={() => copyText(recipientUser.bankName || "", "Ngân hàng")}
                    >
                      {copiedField === "Ngân hàng" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Số tài khoản</span>
                  <div className="flex items-center gap-1 font-semibold font-mono">
                    <span>{recipientUser.accountNumber}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 cursor-pointer"
                      onClick={() => copyText(recipientUser.accountNumber || "", "Số tài khoản")}
                    >
                      {copiedField === "Số tài khoản" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Chủ tài khoản</span>
                  <span className="font-semibold">{recipientUser.accountName}</span>
                </div>

                <Separator />

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Số tiền</span>
                  <div className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-500">
                    <span>{formatVND(activePayment.amount)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-foreground cursor-pointer"
                      onClick={() => copyText(String(activePayment.amount), "Số tiền")}
                    >
                      {copiedField === "Số tiền" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Nội dung CK bắt buộc</span>
                  <div className="flex items-center gap-1 font-bold text-primary font-mono">
                    <span>{transferContent}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-foreground cursor-pointer"
                      onClick={() => copyText(transferContent, "Nội dung chuyển khoản")}
                    >
                      {copiedField === "Nội dung chuyển khoản" ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Hướng dẫn tự động / thủ công */}
              {recipientUser.hasSepay ? (
                <div className="flex items-center justify-center gap-2 text-xs text-amber-600 dark:text-amber-500 font-semibold py-1 bg-amber-500/5 rounded-lg border border-amber-500/10 px-3">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span>Đang chờ xử lý giao dịch...</span>
                </div>
              ) : (
                <div className="bg-primary/5 rounded-xl border border-primary/10 p-3 space-y-3">
                  <p className="text-[11px] text-muted-foreground leading-relaxed text-center">
                    ℹ️ Người nhận là thành viên thường (hoặc chưa cấu hình SePay). Giao dịch này sẽ cần người nhận bấm **Xác nhận nhận tiền** thủ công sau khi bạn chuyển khoản thành công.
                  </p>
                  <Button
                    className="w-full text-xs h-9 font-bold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                    onClick={confirmManualTransfer}
                    disabled={loadingId === "manual-confirm"}
                  >
                    {loadingId === "manual-confirm" && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                    Tôi đã chuyển tiền xong
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
