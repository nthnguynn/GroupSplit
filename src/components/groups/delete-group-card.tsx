"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface DeleteGroupCardProps {
  groupId: string;
  groupName: string;
}

export function DeleteGroupCard({ groupId, groupName }: DeleteGroupCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const isConfirmed = confirmName.trim() === groupName.trim();

  async function handleDeleteGroup() {
    if (!isConfirmed) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        toast.success(data.message || `Đã xoá nhóm "${groupName}" thành công`);
        setOpen(false);
        router.push("/groups");
        router.refresh();
      } else {
        toast.error(data.error || "Không thể xoá nhóm");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Đã xảy ra lỗi kết nối");
    }
  }

  return (
    <>
      <Card className="border-destructive/30 bg-destructive/5 dark:bg-destructive/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Xoá nhóm này
          </CardTitle>
          <CardDescription className="text-xs">
            Chỉ Trưởng nhóm mới có quyền xoá nhóm. Thao tác này sẽ xoá vĩnh viễn toàn bộ dữ liệu (hoá đơn, chia tiền, lịch sử thanh toán) của nhóm và không thể hoàn tác.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setOpen(true)}
            className="gap-2 font-semibold"
          >
            <Trash2 className="h-4 w-4" />
            Giải tán & Xoá nhóm
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Xác nhận xoá vĩnh viễn nhóm?
            </DialogTitle>
            <DialogDescription className="space-y-3 text-xs text-muted-foreground pt-2">
              <div className="text-foreground text-sm">
                Bạn sắp xoá nhóm <strong className="text-destructive">&quot;{groupName}&quot;</strong>. Hành động này sẽ xoá tất cả dữ liệu hoá đơn và giải tán các thành viên.
              </div>
              <div className="space-y-1.5 pt-1">
                <p>
                  Vui lòng nhập chính xác tên nhóm <strong>&quot;{groupName}&quot;</strong> để xác nhận:
                </p>
                <Input
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={`Nhập "${groupName}"`}
                  className="h-9 text-sm"
                />
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteGroup}
              disabled={loading || !isConfirmed}
              className="gap-1.5 font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xoá...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Xác nhận xoá nhóm
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
