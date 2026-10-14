"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { QrCode, Copy, Check, HelpCircle } from "lucide-react";
import { toast } from "sonner";

interface MemberQRActionProps {
  member: {
    user: {
      displayName: string;
      bankName: string | null;
      accountNumber: string | null;
      accountName: string | null;
    };
  };
}

export function MemberQRAction({ member }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const userObj = member?.user || member || {};
  const displayName = userObj.displayName || "Thành viên";
  const bankName = userObj.bankName;
  const accountNumber = userObj.accountNumber;
  const accountName = userObj.accountName;

  // Nếu thành viên chưa cấu hình ngân hàng, hiển thị Popover hướng dẫn/thông báo
  if (!bankName || !accountNumber) {
    return (
      <Popover>
        <PopoverTrigger
          className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3 text-xs bg-popover border border-border shadow-md rounded-lg" align="end">
          <p className="font-semibold text-destructive mb-1">Chưa cấu hình ngân hàng</p>
          <p className="text-muted-foreground leading-relaxed">
            Thành viên này chưa điền thông tin ngân hàng thụ hưởng tại mục Cài đặt cá nhân.
          </p>
        </PopoverContent>
      </Popover>
    );
  }

  // Tạo link ảnh VietQR
  const qrUrl = `https://img.vietqr.io/image/${bankName}-${accountNumber}-compact.png?amount=0&addInfo=Chuyen%20khoan%20GroupSplit&accountName=${encodeURIComponent(accountName || "")}`;

  async function copyAccountNumber() {
    if (!accountNumber) return;
    await navigator.clipboard.writeText(accountNumber);
    setCopied(true);
    toast.success("Đã sao chép số tài khoản!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="h-8 w-8 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10 hover:text-primary cursor-pointer shrink-0"
        title="Xem mã QR thanh toán"
      >
        <QrCode className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xs mx-auto text-center p-6 rounded-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold">Mã QR của {displayName}</DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground">
              Quét mã bằng app ngân hàng để chuyển khoản trực tiếp
            </DialogDescription>
          </DialogHeader>

          {/* QR Image Container */}
          <div className="my-4 flex justify-center bg-white p-3 rounded-xl border shadow-xs max-w-[220px] mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt={`VietQR ${displayName}`}
              className="w-full h-auto max-h-[196px] object-contain"
            />
          </div>

          {/* Bank details card */}
          <div className="bg-muted/50 rounded-xl p-3 text-left text-xs space-y-1.5 border">
            <div>
              <span className="text-muted-foreground">Ngân hàng:</span>{" "}
              <span className="font-bold text-foreground">{bankName}</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">Số tài khoản:</span>{" "}
                <span className="font-mono font-bold text-foreground">{accountNumber}</span>
              </div>
              <button
                onClick={copyAccountNumber}
                className="text-primary hover:text-primary/80 transition-colors p-1 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            {accountName && (
              <div>
                <span className="text-muted-foreground">Chủ tài khoản:</span>{" "}
                <span className="font-semibold text-foreground uppercase">{accountName}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
