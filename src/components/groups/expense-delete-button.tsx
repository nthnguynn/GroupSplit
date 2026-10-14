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
import { Loader2, Trash2 } from "lucide-react";
import { formatVND } from "@/lib/utils/format";

interface ExpenseDeleteButtonProps {
  expenseId: string;
  expenseTitle: string;
  amount: number;
}

export function ExpenseDeleteButton({
  expenseId,
  expenseTitle,
  amount,
}: ExpenseDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);

    try {
      const res = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        toast.success("Đã xóa hóa đơn thành công!");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(data.error || "Không thể xóa hóa đơn");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Đã xảy ra lỗi kết nối, vui lòng thử lại sau.");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1"
        title="Xóa hóa đơn"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3 w-3" />
        Xóa
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Xác nhận xóa hóa đơn
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-sm text-foreground">
              <div>
                Bạn có chắc chắn muốn xóa hóa đơn <strong>&quot;{expenseTitle}&quot;</strong> (
                <strong className="text-destructive">{formatVND(amount)}</strong>) không?
              </div>
              <div className="text-xs text-muted-foreground">
                Lưu ý: Hóa đơn chỉ có thể xóa khi chưa có thành viên nào thanh toán nợ liên quan. Sau khi xóa, các khoản nợ phát sinh từ hóa đơn này sẽ bị hủy bỏ hoàn toàn.
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Xóa vĩnh viễn
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
