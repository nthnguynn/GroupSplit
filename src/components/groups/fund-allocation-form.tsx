"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { formatVND, getInitials } from "@/lib/utils/format";
import { Loader2, Check } from "lucide-react";

interface Member {
  userId: string;
  user: {
    id: string;
    displayName: string;
    avatar: string | null;
  };
}

interface FundAllocationFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  members: Member[];
  onSuccess?: () => void;
}

export function FundAllocationForm({
  isOpen,
  onOpenChange,
  groupId,
  members,
  onSuccess,
}: FundAllocationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("40000"); // Mặc định 40,000 VND
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState("Cấp tiền ăn trưa");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(members.map((m) => m.userId))
  );

  const parsedAmount = parseFloat(amount) || 0;

  function toggleMember(userId: string) {
    const next = new Set(selectedMembers);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelectedMembers(next);
  }

  function selectAll() {
    setSelectedMembers(new Set(members.map((m) => m.userId)));
  }

  function deselectAll() {
    setSelectedMembers(new Set());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedAmount <= 0) {
      toast.error("Số tiền cấp quỹ phải lớn hơn 0");
      return;
    }
    if (selectedMembers.size === 0) {
      toast.error("Vui lòng chọn ít nhất 1 thành viên để nhận quỹ");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/groups/${groupId}/fund-allocations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          date: date.toISOString(),
          note: note.trim() || null,
          recipientIds: Array.from(selectedMembers),
        }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        toast.success(`Đã cấp ${formatVND(parsedAmount)} thành công cho ${selectedMembers.size} thành viên!`);
        router.refresh();
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast.error(data.error || "Cấp tiền quỹ thất bại");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-auto overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-bold text-lg">Cấp tiền quỹ nhóm</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Lập lệnh phân bổ tiền trợ cấp từ quỹ nhóm cho các thành viên được chọn.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="alloc-amount">Số tiền cấp cho mỗi người *</Label>
            <div className="relative">
              <Input
                id="alloc-amount"
                type="text"
                inputMode="numeric"
                value={amount ? parseInt(amount).toLocaleString("vi-VN") : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  setAmount(raw);
                }}
                placeholder="30.000"
                required
                className="h-11 pr-12 text-right font-mono text-base"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                VND
              </span>
            </div>
            {parsedAmount > 0 && (
              <p className="text-xs text-muted-foreground">
                = {formatVND(parsedAmount)} / người
              </p>
            )}
          </div>

          {/* Date & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2 flex flex-col">
              <Label>Ngày cấp quỹ</Label>
              <DatePicker
                value={date}
                onChange={(newDate) => setDate(newDate || new Date())}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="alloc-note">Ghi chú (Tùy chọn)</Label>
              <Input
                id="alloc-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tiền ăn trưa..."
                className="h-11"
              />
            </div>
          </div>

          {/* Recipients Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Thành viên nhận quỹ ({selectedMembers.size})</Label>
              <div className="flex gap-2 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-primary hover:underline cursor-pointer"
                >
                  Chọn hết
                </button>
                <span className="text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="text-destructive hover:underline cursor-pointer"
                >
                  Bỏ chọn hết
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 border rounded-lg bg-muted/20">
              {members.map((m) => {
                const isSelected = selectedMembers.has(m.userId);
                return (
                  <Button
                    key={m.userId}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => toggleMember(m.userId)}
                    className="h-10 justify-start gap-2 relative px-2.5 cursor-pointer text-left min-w-0"
                  >
                    <Avatar className="h-5 w-5 shrink-0">
                      {m.user.avatar && (
                        <AvatarImage src={m.user.avatar} alt={m.user.displayName} className="object-cover" />
                      )}
                      <AvatarFallback className="text-[9px]">
                        {getInitials(m.user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-[11px] font-medium pr-4">{m.user.displayName}</span>
                    {isSelected && (
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary-foreground text-primary rounded-full p-0.5 shrink-0">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>

          {parsedAmount > 0 && selectedMembers.size > 0 && (
            <div className="bg-primary/5 rounded-xl border border-primary/10 p-3 text-xs space-y-1">
              <div className="flex justify-between font-semibold">
                <span className="text-muted-foreground">Tổng tiền quỹ phát ra:</span>
                <span className="text-primary font-bold">{formatVND(parsedAmount * selectedMembers.size)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Số tiền này sẽ được ghi nhận là dư nợ của Người quản lý quỹ đối với các thành viên được chọn.
              </p>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full h-11 font-bold cursor-pointer">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Đang xử lý phân bổ...
              </>
            ) : (
              "Xác nhận cấp quỹ"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
