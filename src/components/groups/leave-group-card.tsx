"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { LogOut, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface LeaveGroupCardProps {
  groupId: string;
  groupName: string;
}

export function LeaveGroupCard({ groupId, groupName }: LeaveGroupCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLeave() {
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/leave`, {
        method: "POST",
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        toast.success(data.message || `Đã rời khỏi nhóm ${groupName}`);
        setOpen(false);
        router.push("/groups");
        router.refresh();
      } else {
        toast.error(data.error || "Rời nhóm thất bại");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Đã xảy ra lỗi kết nối");
    }
  }

  return (
    <>
      <Card className="border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Rời khỏi nhóm
          </CardTitle>
          <CardDescription className="text-xs">
            Rời khỏi nhóm "{groupName}". Bạn chỉ có thể rời nhóm khi dư nợ = 0đ. Toàn bộ thông tin hóa đơn quá khứ của bạn vẫn sẽ được lưu giữ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setOpen(true)}
            className="gap-2 font-semibold"
          >
            <LogOut className="h-4 w-4" />
            Rời nhóm này
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <LogOut className="h-5 w-5" />
              Xác nhận rời khỏi nhóm?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Bạn có chắc chắn muốn rời khỏi nhóm <strong className="text-foreground">"{groupName}"</strong> không?
              Hệ thống sẽ kiểm tra dư nợ của bạn trước khi xử lý.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={loading}>
              Hủy
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLeave} disabled={loading} className="gap-1.5 font-semibold">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Xác nhận rời nhóm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
