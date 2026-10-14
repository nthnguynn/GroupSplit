"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Loader2, Search, ChevronDown, Check, Crown, UserCheck, ShieldCheck } from "lucide-react";
import { getInitials } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

interface Member {
  userId: string;
  user: {
    id: string;
    displayName: string;
    username: string;
    avatar?: string | null;
  };
}

interface FundManagerSettingsProps {
  groupId: string;
  members: Member[];
  currentFundManagerId: string | null;
}

export function FundManagerSettings({
  groupId,
  members,
  currentFundManagerId,
}: FundManagerSettingsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>(currentFundManagerId || "none");

  const selectedMember = useMemo(() => {
    if (selectedId === "none") return null;
    return members.find((m) => m.userId === selectedId) || null;
  }, [members, selectedId]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim().toLowerCase();
    return members.filter(
      (m) =>
        m.user.displayName.toLowerCase().includes(q) ||
        m.user.username.toLowerCase().includes(q)
    );
  }, [search, members]);

  async function handleSave() {
    setLoading(true);
    const fundManagerId = selectedId === "none" ? null : selectedId;

    try {
      const res = await fetch(`/api/groups/${groupId}/fund-manager`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fundManagerId }),
      });

      const data = await res.json();
      setLoading(false);

      if (res.ok) {
        toast.success("Đã cập nhật người quản lý quỹ!");
        router.refresh();
      } else {
        toast.error(data.error || "Cập nhật thất bại");
      }
    } catch (err) {
      setLoading(false);
      toast.error("Lỗi kết nối máy chủ");
    }
  }

  return (
    <Card className="border">
      <CardHeader className="pb-3 border-b bg-muted/30">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          Người quản lý quỹ
        </CardTitle>
        <CardDescription className="text-xs">
          Chỉ định một thành viên chịu trách nhiệm cầm quỹ và phát tiền trợ cấp hàng ngày. Mặc định là Trưởng nhóm.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Custom Member Dropdown với content width = input form width (w-[var(--anchor-width)]) */}
        <div className="space-y-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              className="flex h-11 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition-all hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer select-none"
            >
              {selectedMember ? (
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Avatar className="h-6 w-6 shrink-0 border">
                    <AvatarImage src={selectedMember.user.avatar || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(selectedMember.user.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-2 truncate text-left">
                    <span className="font-bold text-foreground text-sm truncate">
                      {selectedMember.user.displayName}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono truncate">
                      (@{selectedMember.user.username})
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0 flex-1 text-muted-foreground">
                  <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="font-medium text-foreground text-sm truncate">
                    Chưa chỉ định
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 font-normal shrink-0">
                    Mặc định: Trưởng nhóm
                  </Badge>
                </div>
              )}
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
            </PopoverTrigger>

            <PopoverContent
              className="w-[var(--anchor-width)] min-w-[280px] p-0 shadow-lg border rounded-xl"
              align="start"
            >
              {/* Header tìm kiếm thành viên */}
              <div className="p-2 border-b bg-muted/30 flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
                <Input
                  placeholder="Tìm theo tên hoặc @username..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 border-0 bg-transparent focus-visible:ring-0 text-xs shadow-none"
                />
              </div>

              {/* Danh sách người quản lý quỹ */}
              <div className="max-h-[260px] overflow-y-auto p-1 divide-y divide-border/40 scrollbar-thin">
                {/* Tùy chọn 1: Mặc định Trưởng nhóm */}
                <div
                  onClick={() => {
                    setSelectedId("none");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors select-none",
                    selectedId === "none"
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Crown className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground text-xs">Chưa chỉ định</span>
                        <Badge variant="outline" className="text-[9px] px-1 text-muted-foreground">Mặc định</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        Quỹ do Trưởng nhóm tự quản lý
                      </p>
                    </div>
                  </div>
                  {selectedId === "none" && <Check className="h-4 w-4 text-primary shrink-0" />}
                </div>

                {/* Danh sách các thành viên */}
                {filteredMembers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Không tìm thấy thành viên "{search}"
                  </div>
                ) : (
                  filteredMembers.map((m) => {
                    const isSelected = selectedId === m.userId;
                    return (
                      <div
                        key={m.userId}
                        onClick={() => {
                          setSelectedId(m.userId);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer transition-colors select-none",
                          isSelected
                            ? "bg-primary/10 text-primary font-semibold"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                          <Avatar className="h-6 w-6 shrink-0 border">
                            <AvatarImage src={m.user.avatar || undefined} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(m.user.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <span className="font-bold text-foreground text-xs block truncate">
                              {m.user.displayName}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono truncate block">
                              @{m.user.username}
                            </span>
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Button
          onClick={handleSave}
          disabled={loading || selectedId === (currentFundManagerId || "none")}
          className="w-full font-semibold h-10 px-6 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Đang lưu thay đổi...
            </>
          ) : (
            "Lưu người quản lý quỹ"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
