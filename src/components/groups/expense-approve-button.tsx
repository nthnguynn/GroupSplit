"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface ExpenseApproveButtonProps {
  expenseId: string;
}

export function ExpenseApproveButton({ expenseId }: ExpenseApproveButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function handleAction(action: "approve" | "reject") {
    setLoading(action);

    const res = await fetch(`/api/expenses/${expenseId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: action === "approve" ? "APPROVED" : "REJECTED" }),
    });

    setLoading(null);

    if (res.ok) {
      toast.success(action === "approve" ? "Đã duyệt hoá đơn!" : "Đã từ chối hoá đơn!");
      router.refresh();
    } else {
      const data = await res.json();
      toast.error(data.error || "Có lỗi xảy ra");
    }
  }

  return (
    <div className="flex gap-1 mt-2">
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950"
        onClick={() => handleAction("approve")}
        disabled={!!loading}
      >
        {loading === "approve" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3 w-3" />
        )}
        Duyệt
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs gap-1 text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950"
        onClick={() => handleAction("reject")}
        disabled={!!loading}
      >
        {loading === "reject" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <XCircle className="h-3 w-3" />
        )}
        Từ chối
      </Button>
    </div>
  );
}
