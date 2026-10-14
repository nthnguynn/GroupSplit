"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, UserMinus, AlertCircle } from "lucide-react";
import { formatVND } from "@/lib/utils/format";

interface RemoveMemberButtonProps {
  groupId: string;
  memberUserId: string;
  memberDisplayName: string;
  memberBalance: number;
}

export function RemoveMemberButton({
  groupId,
  memberUserId,
  memberDisplayName,
  memberBalance,
}: RemoveMemberButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasUnsettledDebt = Math.abs(memberBalance) > 0.01;

  async function handleRemove() {
    if (hasUnsettledDebt) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/groups/${groupId}/members/${memberUserId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        toast.success(data.message || `Đã xoá ${memberDisplayName} khỏi nhóm`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(data.error || "Không thể xoá thành viên");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Đã xảy ra lỗi kết nối");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1"
        title="Xoá thành viên khỏi nhóm"
        onClick={() => setOpen(true)}
      >
        <UserMinus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Xoá</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <UserMinus className="h-5 w-5" />
              Xác nhận xoá thành viên
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2 text-sm text-foreground">
              <div>
                Bạn có chắc chắn muốn xoá thành viên <strong>&quot;{memberDisplayName}&quot;</strong> khỏi nhóm không?
              </div>

              {hasUnsettledDebt ? (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Chưa thể xoá:</strong> Thành viên này vẫn còn công nợ chưa thanh toán hết (Dư nợ:{" "}
                    <strong>{memberBalance > 0 ? `+${formatVND(memberBalance)}` : formatVND(memberBalance)}</strong>
                    ). Cần thanh toán nợ về 0đ trước khi xoá khỏi nhóm.
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border bg-muted/50 text-xs text-muted-foreground leading-relaxed">
                  ✓ <strong>Bảo toàn dữ liệu:</strong> Tất cả hoá đơn cũ trong nhóm có liên quan đến thành viên này vẫn sẽ <strong>hiển thị tên người đấy bình thường</strong>. Thành viên này chỉ không thể tham gia vào các hoá đơn mới hay xem nhóm nữa.
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              disabled={loading || hasUnsettledDebt}
              className="gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <UserMinus className="h-4 w-4" />
                  Xoá khỏi nhóm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
