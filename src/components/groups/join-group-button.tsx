"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, UserPlus, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

interface JoinGroupButtonProps {
  groupId: string;
  initialPending?: boolean;
}

export function JoinGroupButton({ groupId, initialPending = false }: JoinGroupButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(initialPending);

  async function handleJoin() {
    setLoading(true);

    const res = await fetch(`/api/groups/${groupId}/join`, {
      method: "POST",
    });

    let data: any = {};
    try {
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = { error: `Đã xảy ra lỗi trên hệ thống (Mã lỗi: ${res.status})` };
      }
    } catch (e) {
      data = { error: "Không thể xử lý phản hồi từ hệ thống" };
    }
    setLoading(false);

    if (res.ok) {
      toast.success(data.message || "Đã gửi yêu cầu gia nhập nhóm!");
      setIsPending(true);
    } else {
      toast.error(data.error || "Gửi yêu cầu gia nhập thất bại");
    }
  }

  if (isPending) {
    return (
      <div className="space-y-3">
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium flex items-center justify-center gap-2">
          <Clock className="h-4 w-4 shrink-0 animate-pulse" />
          <span>Đã gửi yêu cầu, đang chờ Trưởng nhóm phê duyệt</span>
        </div>
        <Button asChild variant="outline" className="w-full text-xs">
          <Link href="/groups" className="gap-1.5">
            Quay về danh sách Nhóm
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handleJoin}
      disabled={loading}
      className="w-full gap-2"
      size="lg"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      Gửi yêu cầu tham gia nhóm
    </Button>
  );
}
