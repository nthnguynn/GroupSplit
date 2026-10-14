"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { formatVND, getInitials } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import { Loader2, Equal, Sliders, Check, ChevronDown, Clock, Wallet, Coins, Users, ShieldCheck } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { CategorySelectDropdown } from "@/components/expenses/category-select-dropdown";

interface Category {
  id: string;
  name: string;
  icon: string;
  parentId: string | null;
}

interface CategoryNode extends Category {
  children: CategoryNode[];
}

function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  categories.forEach((cat) => {
    const node = map.get(cat.id)!;
    if (cat.parentId) {
      const parent = map.get(cat.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function flattenTree(nodes: CategoryNode[], depth = 0): Array<{ category: CategoryNode; depth: number }> {
  const result: Array<{ category: CategoryNode; depth: number }> = [];
  nodes.forEach((node) => {
    result.push({ category: node, depth });
    if (node.children && node.children.length > 0) {
      result.push(...flattenTree(node.children, depth + 1));
    }
  });
  return result;
}

interface Member {
  userId: string;
  displayName: string;
  avatar?: string | null;
}

export interface InitialExpense {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  splitType: "EQUAL" | "CUSTOM";
  date: string | Date;
  category: string;
  categoryId?: string | null;
  paidById: string;
  fundingSource?: string;
  createdAt: string | Date;
  splits: {
    id?: string;
    userId: string;
    amount: number;
    shares?: number;
  }[];
}

interface AddExpenseFormProps {
  groupId: string;
  members: Member[];
  currentUserId: string;
  initialExpense?: InitialExpense;
}

const CATEGORIES = [
  { id: "Ăn uống", label: "Ăn uống", emoji: "🍽️" },
  { id: "Di chuyển", label: "Di chuyển", emoji: "🚗" },
  { id: "Mua sắm", label: "Mua sắm", emoji: "🛒" },
  { id: "Giải trí", label: "Giải trí", emoji: "🎉" },
  { id: "Sinh hoạt", label: "Sinh hoạt", emoji: "🏠" },
  { id: "Khác", label: "Khác", emoji: "📦" },
];

export function AddExpenseForm({ groupId, members, currentUserId, initialExpense }: AddExpenseFormProps) {
  const router = useRouter();
  const isEdit = !!initialExpense;
  const [loading, setLoading] = useState(false);
  const [fundingSource, setFundingSource] = useState<"MEMBER" | "FUND">(
    initialExpense?.fundingSource === "FUND" ? "FUND" : "MEMBER"
  );
  const [splitType, setSplitType] = useState<"EQUAL" | "CUSTOM">(
    initialExpense?.splitType || "EQUAL"
  );
  const [amount, setAmount] = useState(
    initialExpense ? initialExpense.amount.toString() : ""
  );
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(() => {
    if (initialExpense?.splits?.length) {
      return new Set(initialExpense.splits.map((s) => s.userId));
    }
    return new Set(members.map((m) => m.userId));
  });
  const [customSplits, setCustomSplits] = useState<Record<string, string>>(() => {
    if (initialExpense?.splits) {
      const splitsMap: Record<string, string> = {};
      initialExpense.splits.forEach((s) => {
        splitsMap[s.userId] = s.amount.toString();
      });
      return splitsMap;
    }
    return {};
  });
  const [customPercents, setCustomPercents] = useState<Record<string, string>>({});
  const [memberShares, setMemberShares] = useState<Record<string, string>>(() => {
    if (initialExpense?.splits) {
      const sharesMap: Record<string, string> = {};
      initialExpense.splits.forEach((s) => {
        sharesMap[s.userId] = (s.shares ?? 1).toString();
      });
      return sharesMap;
    }
    return {};
  });
  const [customSplitSubtype, setCustomSplitSubtype] = useState<"AMOUNT" | "PERCENT">("AMOUNT");
  const [paidById, setPaidById] = useState(
    initialExpense ? initialExpense.paidById : currentUserId
  );
  const [category, setCategory] = useState(
    initialExpense ? initialExpense.category : "Khác"
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    initialExpense?.categoryId ?? null
  );
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [date, setDate] = useState<Date>(
    initialExpense ? new Date(initialExpense.date) : new Date()
  );



  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch(`/api/groups/${groupId}/categories`);
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
          if (!initialExpense) {
            // Mặc định chọn danh mục gốc "Khác"
            const defaultCat = data.find((c: Category) => c.name === "Khác" && c.parentId === null) || data[0];
            if (defaultCat) {
              setSelectedCategoryId(defaultCat.id);
              setCategory(defaultCat.name);
            }
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải danh mục:", err);
      }
    }
    loadCategories();
  }, [groupId, initialExpense]);

  const parsedAmount = parseFloat(amount) || 0;

  // Tính toán chia đều theo số suất (shares)
  const totalShares = Array.from(selectedMembers).reduce((sum, userId) => {
    const s = parseFloat(memberShares[userId] ?? "1");
    return sum + (isNaN(s) || s <= 0 ? 1 : s);
  }, 0);

  const shareUnit = totalShares > 0 ? parsedAmount / totalShares : 0;

  function getMemberEqualAmount(userId: string): number {
    if (!selectedMembers.has(userId) || totalShares <= 0 || parsedAmount <= 0) return 0;
    const s = parseFloat(memberShares[userId] ?? "1");
    const shareVal = isNaN(s) || s <= 0 ? 1 : s;
    return Math.round(shareUnit * shareVal);
  }

  function handleShareChange(userId: string, newShareStr: string) {
    setMemberShares((prev) => ({
      ...prev,
      [userId]: newShareStr,
    }));
  }

  function handleShareStep(userId: string, delta: number) {
    const current = parseFloat(memberShares[userId] ?? "1");
    const validCurrent = isNaN(current) || current <= 0 ? 1 : current;
    const next = Math.max(0.5, Number((validCurrent + delta).toFixed(1)));
    handleShareChange(userId, next.toString());
  }

  function calculateEqualSplits(): { userId: string; amount: number; shares: number }[] {
    if (selectedMembers.size === 0 || parsedAmount <= 0) return [];

    const selectedArray = Array.from(selectedMembers);
    const rawSplits = selectedArray.map((userId) => {
      const s = parseFloat(memberShares[userId] ?? "1");
      const shareVal = isNaN(s) || s <= 0 ? 1 : s;
      const amt = Math.round(shareUnit * shareVal);
      return { userId, amount: amt, shares: shareVal };
    });

    // Bù chênh lệch làm tròn vào người trả tiền nếu được chọn, hoặc người có số suất lớn nhất
    const totalCalc = rawSplits.reduce((sum, r) => sum + r.amount, 0);
    const diff = parsedAmount - totalCalc;
    if (diff !== 0 && rawSplits.length > 0) {
      let targetIndex = rawSplits.findIndex((r) => r.userId === paidById);
      if (targetIndex === -1) {
        let maxShares = -1;
        rawSplits.forEach((r, idx) => {
          if (r.shares > maxShares) {
            maxShares = r.shares;
            targetIndex = idx;
          }
        });
      }
      if (targetIndex !== -1) {
        rawSplits[targetIndex].amount += diff;
      }
    }

    return rawSplits;
  }

  // Custom splits total
  const customTotal = customSplitSubtype === "AMOUNT"
    ? Object.entries(customSplits)
        .filter(([userId]) => selectedMembers.has(userId))
        .reduce((sum, [, val]) => sum + (parseFloat(val) || 0), 0)
    : Object.entries(customPercents)
        .filter(([userId]) => selectedMembers.has(userId))
        .reduce((sum, [, val]) => sum + (parsedAmount * (parseFloat(val) || 0) / 100), 0);

  const customRemaining = parsedAmount - customTotal;

  // Unassigned members (no value entered or equals 0)
  const unassignedMembers = Array.from(selectedMembers).filter((userId) => {
    if (customSplitSubtype === "AMOUNT") {
      const val = customSplits[userId];
      return !val || parseFloat(val) === 0;
    } else {
      const val = customPercents[userId];
      return !val || parseFloat(val) === 0;
    }
  });

  function handleAutoDistributeRemaining() {
    if (unassignedMembers.length < 2) return;

    if (customSplitSubtype === "AMOUNT") {
      const assignedSum = Array.from(selectedMembers)
        .filter((userId) => !unassignedMembers.includes(userId))
        .reduce((sum, userId) => sum + (parseFloat(customSplits[userId]) || 0), 0);
      const remaining = parsedAmount - assignedSum;
      if (remaining <= 0) return;

      const share = Math.round(remaining / unassignedMembers.length);
      const nextSplits = { ...customSplits };
      
      let distributedSum = 0;
      unassignedMembers.forEach((userId, index) => {
        if (index === unassignedMembers.length - 1) {
          const lastShare = remaining - distributedSum;
          nextSplits[userId] = lastShare > 0 ? lastShare.toString() : "0";
        } else {
          nextSplits[userId] = share.toString();
          distributedSum += share;
        }
      });
      setCustomSplits(nextSplits);
    } else {
      const assignedSum = Array.from(selectedMembers)
        .filter((userId) => !unassignedMembers.includes(userId))
        .reduce((sum, userId) => sum + (parseFloat(customPercents[userId]) || 0), 0);
      const remaining = 100 - assignedSum;
      if (remaining <= 0) return;

      const share = remaining / unassignedMembers.length;
      const nextPercents = { ...customPercents };

      let distributedSum = 0;
      unassignedMembers.forEach((userId, index) => {
        if (index === unassignedMembers.length - 1) {
          const lastShare = Number((remaining - distributedSum).toFixed(1));
          nextPercents[userId] = lastShare > 0 ? lastShare.toString() : "0";
        } else {
          const formattedShare = Number(share.toFixed(1));
          nextPercents[userId] = formattedShare.toString();
          distributedSum += formattedShare;
        }
      });
      setCustomPercents(nextPercents);
    }
  }

  function handleSwitchSubtype(type: "AMOUNT" | "PERCENT") {
    if (type === customSplitSubtype) return;

    if (type === "PERCENT") {
      const nextPercents: Record<string, string> = {};
      selectedMembers.forEach((userId) => {
        const amt = parseFloat(customSplits[userId] || "0");
        if (amt > 0 && parsedAmount > 0) {
          const pct = ((amt / parsedAmount) * 100).toFixed(1);
          nextPercents[userId] = pct.endsWith(".0") ? pct.slice(0, -2) : pct;
        } else {
          nextPercents[userId] = "";
        }
      });
      setCustomPercents(nextPercents);
    } else {
      const nextSplits: Record<string, string> = {};
      selectedMembers.forEach((userId) => {
        const pct = parseFloat(customPercents[userId] || "0");
        if (pct > 0) {
          const amt = Math.round(parsedAmount * (pct / 100));
          nextSplits[userId] = amt > 0 ? amt.toString() : "";
        } else {
          nextSplits[userId] = "";
        }
      });
      setCustomSplits(nextSplits);
    }
    setCustomSplitSubtype(type);
  }

  function toggleMember(userId: string) {
    const next = new Set(selectedMembers);
    if (next.has(userId)) {
      if (next.size <= 1) return; // tối thiểu 1 người
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelectedMembers(next);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    if (parsedAmount <= 0) {
      toast.error("Số tiền phải lớn hơn 0");
      setLoading(false);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const dateStr = date.toISOString();

    // Build splits
    let splits: { userId: string; amount: number; shares?: number }[];

    if (splitType === "EQUAL") {
      splits = calculateEqualSplits();
    } else {
      splits = Array.from(selectedMembers).map((userId) => {
        let memberAmount = 0;
        if (customSplitSubtype === "AMOUNT") {
          memberAmount = parseFloat(customSplits[userId] || "0");
        } else {
          const pct = parseFloat(customPercents[userId] || "0");
          memberAmount = Math.round(parsedAmount * (pct / 100));
        }
        return {
          userId,
          amount: memberAmount,
          shares: 1,
        };
      });

      // Adjust last item to absorb rounding difference if any
      const totalSplitsSum = splits.reduce((sum, s) => sum + s.amount, 0);
      const diff = parsedAmount - totalSplitsSum;
      if (diff !== 0 && splits.length > 0) {
        splits[splits.length - 1].amount += diff;
      }

      if (Math.abs(customRemaining) > 1) {
        toast.error(`Còn thiếu ${formatVND(Math.abs(customRemaining))} chưa phân bổ`);
        setLoading(false);
        return;
      }
    }

    try {
      const endpoint = isEdit
        ? `/api/expenses/${initialExpense.id}`
        : `/api/groups/${groupId}/expenses`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          amount: parsedAmount,
          paidById,
          splitType,
          date: dateStr,
          splits,
          category,
          categoryId: selectedCategoryId,
          fundingSource,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || (isEdit ? "Cập nhật hoá đơn thất bại" : "Thêm hoá đơn thất bại"));
        setLoading(false);
      } else {
        toast.success(
          data?.status === "APPROVED"
            ? isEdit
              ? "Đã cập nhật hoá đơn thành công!"
              : "Đã thêm hoá đơn thành công!"
            : isEdit
            ? "Đã cập nhật hoá đơn! Đang chờ Trưởng nhóm duyệt lại."
            : "Đã thêm hoá đơn! Đang chờ Trưởng nhóm duyệt."
        );
        router.push(`/groups/${groupId}`);
        router.refresh();
      }
    } catch (err) {
      console.error("Lỗi khi lưu hoá đơn:", err);
      toast.error("Đã xảy ra lỗi kết nối, vui lòng thử lại");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isEdit && (
        <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-center gap-3 text-xs sm:text-sm">
          <Clock className="h-4 w-4 text-blue-500 shrink-0" />
          <div>
            <span className="font-semibold text-blue-600 dark:text-blue-400">Chế độ chỉnh sửa: </span>
            <span>
              Bạn đang chỉnh sửa hoá đơn này (chưa có ai thanh toán nợ liên quan).
            </span>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="expense-title">Tên hoá đơn *</Label>
            <Input
              id="expense-title"
              name="title"
              defaultValue={initialExpense?.title}
              placeholder="VD: Tiền ăn trưa, Tiền xăng..."
              required
              className="h-11"
            />
          </div>

          {/* Custom Category Dropdown */}
          <div className="space-y-2">
            <Label>Danh mục chi tiêu *</Label>
            <CategorySelectDropdown
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={(cat) => {
                setSelectedCategoryId(cat.id);
                setCategory(cat.name);
              }}
              loading={categories.length === 0}
            />
          </div>

          {/* Amount & Date Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Tổng tiền (VND) *</Label>
              <div className="relative">
                <Input
                  id="expense-amount"
                  type="text"
                  value={amount ? parseInt(amount).toLocaleString("vi-VN") : ""}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setAmount(raw);
                  }}
                  placeholder="0"
                  required
                  className="h-11 pr-12 font-mono text-base"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  VND
                </span>
              </div>
              {parsedAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  = {formatVND(parsedAmount)}
                </p>
              )}
            </div>

            {/* Date */}
            <div className="space-y-2 flex flex-col justify-start">
              <Label className="h-5 flex items-center">Ngày</Label>
              <DatePicker
                value={date}
                onChange={(newDate) => setDate(newDate || new Date())}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="expense-desc">Ghi chú (tuỳ chọn)</Label>
            <Textarea
              id="expense-desc"
              name="description"
              defaultValue={initialExpense?.description || ""}
              placeholder="Mô tả thêm..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Funding Source Card */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-bold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Nguồn tiền chi trả *
            </Label>
            <p className="text-xs text-muted-foreground">
              Chọn chi phí này được trích từ nguồn tiền nào
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFundingSource("MEMBER")}
              className={cn(
                "p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3",
                fundingSource === "MEMBER"
                  ? "border-primary bg-primary/10 text-primary shadow-xs"
                  : "border-border hover:bg-muted/50 text-muted-foreground"
              )}
            >
              <Users className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">Cá nhân tự chi</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Một thành viên bỏ tiền túi ra thanh toán, số tiền được chia cho người tham gia và phát sinh công nợ cá nhân.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFundingSource("FUND")}
              className={cn(
                "p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3",
                fundingSource === "FUND"
                  ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 shadow-xs"
                  : "border-border hover:bg-muted/50 text-muted-foreground"
              )}
            >
              <Coins className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">Chi từ Quỹ nhóm</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Trích trực tiếp từ Quỹ chung của nhóm. Các thành viên tham gia không phải trả nợ cá nhân (quỹ đài thọ).
                </p>
              </div>
            </button>
          </div>

          {fundingSource === "FUND" && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Lưu ý khi chi từ Quỹ nhóm:
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                - Tiền sẽ trừ trực tiếp vào Quỹ nhóm sau khi Trưởng nhóm phê duyệt.
                <br />
                - Phía dưới, hãy chọn người thực tế đã thanh toán (Trưởng nhóm rút tiền quỹ hoặc thành viên ứng tiền túi để được Trưởng nhóm hoàn lại).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payer */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Label>
            {fundingSource === "FUND"
              ? "Ai là người đã thanh toán thực tế? (Trưởng nhóm hoặc người ứng tiền túi) *"
              : "Ai là người đã trả? *"}
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {members.map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => setPaidById(m.userId)}
                className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                  paidById === m.userId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent"
                }`}
              >
                <Avatar className="h-6 w-6 shrink-0">
                  {m.avatar && (
                    <AvatarImage src={m.avatar} alt={m.displayName} className="object-cover" />
                  )}
                  <AvatarFallback className="text-xs">
                    {getInitials(m.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{m.displayName}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Split type */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSplitType("EQUAL")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                splitType === "EQUAL"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              <Equal className="h-4 w-4" />
              Chia đều
            </button>
            <button
              type="button"
              onClick={() => setSplitType("CUSTOM")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                splitType === "CUSTOM"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-accent"
              }`}
            >
              <Sliders className="h-4 w-4" />
              Chia riêng
            </button>
          </div>

          <Separator />
          
          {/* Custom mode switch */}
          {splitType === "CUSTOM" && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Chế độ chia riêng:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSwitchSubtype("AMOUNT")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                    customSplitSubtype === "AMOUNT"
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Số tiền (đ)
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchSubtype("PERCENT")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                    customSplitSubtype === "PERCENT"
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  Tỷ lệ (%)
                </button>
              </div>
            </div>
          )}

          <Separator />

          {/* Member selection */}
          <div className="space-y-2">
            <Label>Ai trong hoá đơn này?</Label>
            <div className="space-y-2">
              {members.map((m) => {
                const isSelected = selectedMembers.has(m.userId);
                return (
                  <div
                    key={m.userId}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isSelected ? "border-primary/50 bg-primary/5" : "border-border opacity-60"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleMember(m.userId)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </button>
                     <Avatar className="h-7 w-7 shrink-0">
                      {m.avatar && (
                        <AvatarImage src={m.avatar} alt={m.displayName} className="object-cover" />
                      )}
                      <AvatarFallback className="text-xs">
                        {getInitials(m.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-sm font-medium">{m.displayName}</span>
                    {isSelected && (
                      <div className="shrink-0 flex items-center gap-2">
                        {splitType === "EQUAL" ? (
                          <div className="flex items-center gap-1.5">
                            {/* Bộ điều khiển số suất */}
                            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-background h-8 shadow-xs">
                              <button
                                type="button"
                                onClick={() => handleShareStep(m.userId, -0.5)}
                                title="Giảm 0.5 suất"
                                className="px-2 h-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <div className="w-11 h-full flex items-center">
                                <input
                                  type="text"
                                  value={memberShares[m.userId] ?? "1"}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9.]/g, "");
                                    const parts = val.split(".");
                                    const clean = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : val;
                                    handleShareChange(m.userId, clean);
                                  }}
                                  className="w-full h-full text-center text-xs font-semibold bg-transparent focus:outline-none"
                                  placeholder="1"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleShareStep(m.userId, 0.5)}
                                title="Tăng 0.5 suất"
                                className="px-2 h-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-xs font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-medium">suất</span>

                            <Badge variant="outline" className="text-xs font-mono ml-1 min-w-[72px] justify-end">
                              {parsedAmount > 0 ? formatVND(getMemberEqualAmount(m.userId)) : "—"}
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {customSplitSubtype === "PERCENT" && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                ({formatVND(parsedAmount * (parseFloat(customPercents[m.userId] || "0") / 100))})
                              </span>
                            )}
                            <div className="relative">
                              <Input
                                value={
                                  customSplitSubtype === "AMOUNT"
                                    ? (customSplits[m.userId] ? parseInt(customSplits[m.userId]).toLocaleString("vi-VN") : "")
                                    : (customPercents[m.userId] || "")
                                }
                                onChange={(e) => {
                                  if (customSplitSubtype === "AMOUNT") {
                                    const raw = e.target.value.replace(/[^0-9]/g, "");
                                    setCustomSplits((prev) => ({
                                      ...prev,
                                      [m.userId]: raw,
                                    }));
                                  } else {
                                    const raw = e.target.value.replace(/[^0-9.]/g, "");
                                    const parts = raw.split(".");
                                    const clean = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : raw;
                                    setCustomPercents((prev) => ({
                                      ...prev,
                                      [m.userId]: clean,
                                    }));
                                  }
                                }}
                                placeholder="0"
                                className="w-28 h-8 text-right text-xs font-mono pr-7"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                {customSplitSubtype === "AMOUNT" ? "đ" : "%"}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Thông tin tổng số suất trong chế độ Chia đều */}
            {splitType === "EQUAL" && parsedAmount > 0 && totalShares > 0 && totalShares !== selectedMembers.size && (
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs mt-3">
                <span className="text-muted-foreground">
                  Tổng cộng: <strong className="text-foreground font-semibold">{totalShares} suất</strong> ({selectedMembers.size} người)
                </span>
                <span className="font-semibold text-primary">
                  ~{formatVND(Math.round(parsedAmount / totalShares))} / suất
                </span>
              </div>
            )}

            {splitType === "CUSTOM" && parsedAmount > 0 && (
              <div className="space-y-3 mt-3">
                {unassignedMembers.length >= 2 && customRemaining > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoDistributeRemaining}
                    className="w-full text-xs font-bold border-primary/30 text-primary hover:bg-primary/5 gap-1.5 h-9"
                  >
                    <Equal className="h-3.5 w-3.5" />
                    Chia đều {formatVND(customRemaining)} còn lại cho {unassignedMembers.length} người chưa điền
                  </Button>
                )}
                
                <div
                  className={`p-3 rounded-lg text-sm ${
                    Math.abs(customRemaining) < 1
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600"
                  }`}
                >
                  {Math.abs(customRemaining) < 1
                    ? "✓ Đã phân bổ đủ số tiền"
                    : customRemaining > 0
                    ? `Còn ${formatVND(customRemaining)} chưa phân bổ`
                    : `Đã vượt ${formatVND(-customRemaining)}`}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1 h-12 text-base font-semibold border-border hover:bg-accent"
          onClick={() => router.back()}
          disabled={loading}
        >
          Huỷ
        </Button>
        <Button 
          type="submit" 
          size="lg" 
          className="flex-1 h-12 text-base font-semibold shadow-md gap-2" 
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Đang xử lý...
            </>
          ) : isEdit ? (
            "Lưu thay đổi"
          ) : (
            "Thêm hoá đơn"
          )}
        </Button>
      </div>
    </form>
  );
}
