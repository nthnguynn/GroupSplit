"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { endOfDay, startOfDay } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { ExpenseApproveButton } from "./expense-approve-button";
import { formatVND, formatDate } from "@/lib/utils/format";
import { Receipt, Calendar, ArrowLeft, ArrowRight, CheckCircle2, Clock, XCircle, Pencil } from "lucide-react";
import Link from "next/link";
import { ExpenseDeleteButton } from "./expense-delete-button";

interface Settlement {
  id: string;
  amount: number;
  isConfirmed: boolean;
  createdAt: string | Date;
  fromUserId: string;
  toUserId: string;
}

interface Split {
  id: string;
  amount: number;
  shares?: number;
  isPaid: boolean;
  userId?: string;
  user: {
    id?: string;
    displayName: string;
  };
}

interface Expense {
  id: string;
  title: string;
  amount: number;
  splitType: string;
  status: string;
  date: string;
  fundingSource?: string;
  createdAt?: string | Date;
  createdById?: string;
  paidById?: string;
  category: string;
  categoryIcon?: string;
  paidBy: {
    id?: string;
    displayName: string;
  };
  splits: Split[];
}

interface ExpensesListProps {
  /** Hoá đơn chờ duyệt (đã lọc theo ngày) + hoá đơn đã xử lý của trang hiện tại — lọc/phân trang ở server */
  expenses: Expense[];
  processedTotal: number;
  currentPage: number;
  totalPages: number;
  /** Mốc ISO của bộ lọc ngày đang áp dụng (từ URL) */
  dateFrom?: string;
  dateTo?: string;
  settlements?: Settlement[];
  isOwner: boolean;
  groupId: string;
  currentUserId: string;
  currentUserName: string;
}

const categoryEmojis: Record<string, string> = {
  "Ăn uống": "🍽️",
  "Di chuyển": "🚗",
  "Mua sắm": "🛒",
  "Giải trí": "🎉",
  "Sinh hoạt": "🏠",
  "Khác": "📦",
};

const statusIcon = {
  APPROVED: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  PENDING: <Clock className="h-4 w-4 text-amber-500" />,
  REJECTED: <XCircle className="h-4 w-4 text-rose-500" />,
};

const statusLabel = {
  APPROVED: "Đã duyệt",
  PENDING: "Chờ duyệt",
  REJECTED: "Từ chối",
};

export function ExpensesList({
  expenses,
  processedTotal,
  currentPage,
  totalPages,
  dateFrom,
  dateTo,
  settlements,
  isOwner,
  groupId,
  currentUserId,
  currentUserName,
}: ExpensesListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();

  const dateRange: DateRange | undefined =
    dateFrom || dateTo
      ? { from: dateFrom ? new Date(dateFrom) : undefined, to: dateTo ? new Date(dateTo) : undefined }
      : undefined;

  // Bộ lọc & trang nằm trên URL để server chỉ trả về đúng phần cần hiển thị
  const navigate = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const goToPage = (page: number) => navigate({ page: page > 1 ? String(page) : null });

  const isExpenseLocked = (expense: Expense) => {
    if (!settlements || settlements.length === 0) return false;
    const payerId = expense.paidById || (expense.paidBy as any)?.id;
    if (!payerId) return false;

    const debtorIds = expense.splits
      .map((s) => s.userId || (s as any).user?.id)
      .filter((id) => id && id !== payerId);

    if (debtorIds.length === 0) return false;

    const expenseCreatedTime = new Date(expense.createdAt || expense.date).getTime();

    return settlements.some((s) => {
      if (!s.isConfirmed) return false;
      const sTime = new Date(s.createdAt).getTime();
      if (sTime < expenseCreatedTime) return false;
      return (
        (s.fromUserId === payerId && debtorIds.includes(s.toUserId)) ||
        (s.toUserId === payerId && debtorIds.includes(s.fromUserId))
      );
    });
  };

  const canEditExpense = (expense: Expense) => {
    const isLocked = isExpenseLocked(expense);
    const canUser = expense.createdById === currentUserId || isOwner;
    return !isLocked && canUser;
  };

  const canDeleteExpense = (expense: Expense) => {
    const isLocked = isExpenseLocked(expense);
    return !isLocked && isOwner;
  };

  // Server đã lọc theo ngày và sắp xếp: chờ duyệt ở trên, đã xử lý theo ngày mới nhất
  const pendingExpenses = expenses.filter((e) => e.status === "PENDING");
  const paginatedExpenses = expenses.filter((e) => e.status !== "PENDING");
  const hasAnyExpense = pendingExpenses.length > 0 || processedTotal > 0;

  const handleDateRangeChange = (range: DateRange | undefined) => {
    navigate({
      from: range?.from ? startOfDay(range.from).toISOString() : null,
      to: range?.to ? endOfDay(range.to).toISOString() : null,
      page: null,
    });
  };

  // Group by Month function
  const groupExpensesByMonth = (list: Expense[]) => {
    const groups: Record<string, Expense[]> = {};
    for (const exp of list) {
      const d = new Date(exp.date);
      const monthStr = `Tháng ${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      if (!groups[monthStr]) {
        groups[monthStr] = [];
      }
      groups[monthStr].push(exp);
    }
    return groups;
  };

  const groupedExpenses = groupExpensesByMonth(paginatedExpenses);

  return (
    <div className="space-y-4">
      {/* Date range filter */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="text-left w-full md:w-auto space-y-0.5">
            <h4 className="font-bold text-sm flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              Bộ lọc khoảng thời gian
            </h4>
            <p className="text-[11px] text-muted-foreground">Lọc danh sách hoá đơn của nhóm</p>
          </div>
          <div className="w-full md:w-auto flex items-stretch md:items-center justify-start md:justify-end">
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              placeholder="Chọn khoảng ngày"
            />
          </div>
        </CardContent>
      </Card>

      {/* Mục hoá đơn cần duyệt (Cho Trưởng nhóm & Thành viên) */}
      {pendingExpenses.length > 0 && (
        <div className="space-y-3 p-4 rounded-2xl border-2 border-amber-500/40 bg-amber-500/5 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
              <h3 className="font-extrabold text-sm sm:text-base text-amber-900 dark:text-amber-200">
                Hoá đơn cần duyệt ({pendingExpenses.length})
              </h3>
            </div>
            {isOwner && (
              <Badge className="bg-amber-500 text-white hover:bg-amber-600 text-xs font-semibold px-2.5 py-0.5">
                Trưởng nhóm duyệt
              </Badge>
            )}
          </div>
          
          <div className="space-y-2.5">
            {pendingExpenses.map((expense) => (
              <Card key={expense.id} className="border-amber-500/30 bg-card shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-bold text-sm">{expense.title}</h4>
                        <Badge variant="secondary" className="text-[11px] font-medium py-0 px-2 h-5">
                          {expense.categoryIcon || categoryEmojis[expense.category] || "📦"} {expense.category}
                        </Badge>
                        {expense.fundingSource === "FUND" && (
                          <Badge variant="secondary" className="text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 font-bold">
                            🏦 Quỹ nhóm
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[11px] border-amber-500 text-amber-600 bg-amber-500/10">
                          Chờ duyệt
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {expense.splitType === "EQUAL" ? "Chia đều" : "Chia riêng"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Người trả:{" "}
                        <span className={`font-semibold ${
                          expense.paidBy.displayName === currentUserName
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-foreground"
                        }`}>
                          {expense.paidBy.displayName === currentUserName
                            ? "Bạn"
                            : expense.paidBy.displayName}
                        </span>{" "}
                        • {formatDate(expense.date)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {expense.splits.map((split) => {
                          const isCurrentUser = split.user.displayName === currentUserName;
                          const sharesLabel = split.shares && split.shares !== 1 ? ` (x${split.shares})` : "";
                          return (
                            <span
                              key={split.id}
                              className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                                isCurrentUser
                                  ? split.isPaid
                                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20"
                                  : split.isPaid
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {isCurrentUser ? "Bạn" : split.user.displayName}{sharesLabel}: {formatVND(split.amount)}
                              {split.isPaid && " ✓"}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <p className="font-extrabold text-base text-amber-600 dark:text-amber-400">{formatVND(expense.amount)}</p>
                      <div className="flex items-center gap-1">
                        {canEditExpense(expense) && (
                          <Link
                            href={`/groups/${groupId}/expenses/${expense.id}/edit`}
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "sm" }),
                              "h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 hover:bg-amber-500/10 cursor-pointer"
                            )}
                          >
                            <Pencil className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            Sửa
                          </Link>
                        )}
                        {canDeleteExpense(expense) && (
                          <ExpenseDeleteButton
                            expenseId={expense.id}
                            expenseTitle={expense.title}
                            amount={expense.amount}
                          />
                        )}
                        {isOwner && (
                          <ExpenseApproveButton expenseId={expense.id} />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Expenses list (Processed) */}
      {!hasAnyExpense ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Receipt className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mb-3">Không có hoá đơn nào khớp bộ lọc</p>
          </CardContent>
        </Card>
      ) : processedTotal === 0 && pendingExpenses.length > 0 ? (
        <p className="text-xs text-center text-muted-foreground py-4">Tất cả hoá đơn hiện tại đang chờ duyệt ở trên.</p>
      ) : (
        <div className={cn("space-y-6 transition-opacity", isNavigating && "opacity-60")}>
          {Object.entries(groupedExpenses).map(([monthHeader, list]) => (
            <div key={monthHeader} className="space-y-3">
              <div className="flex items-center gap-2 px-1 py-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                  {monthHeader}
                </span>
                <div className="h-px bg-border flex-1" />
              </div>

              {list.map((expense) => (
                <Card key={expense.id} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-medium text-sm">{expense.title}</h3>
                          <Badge variant="secondary" className="text-[11px] font-medium py-0 px-2 h-5">
                            {expense.categoryIcon || categoryEmojis[expense.category] || "📦"} {expense.category}
                          </Badge>
                          {expense.fundingSource === "FUND" && (
                            <Badge variant="secondary" className="text-[11px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 font-bold">
                              🏦 Quỹ nhóm
                            </Badge>
                          )}
                          <div className="flex items-center gap-1">
                            {statusIcon[expense.status as keyof typeof statusIcon]}
                            <span className="text-xs text-muted-foreground">
                              {statusLabel[expense.status as keyof typeof statusLabel]}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {expense.splitType === "EQUAL" ? "Chia đều" : "Chia riêng"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Người trả:{" "}
                          <span className={`font-semibold ${
                            expense.paidBy.displayName === currentUserName
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-foreground"
                          }`}>
                            {expense.paidBy.displayName === currentUserName
                              ? "Bạn"
                              : expense.paidBy.displayName}
                          </span>{" "}
                          • {formatDate(expense.date)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {expense.splits.map((split) => {
                            const isCurrentUser = split.user.displayName === currentUserName;
                            const sharesLabel = split.shares && split.shares !== 1 ? ` (x${split.shares})` : "";
                            return (
                              <span
                                key={split.id}
                                className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                                  isCurrentUser
                                    ? split.isPaid
                                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30"
                                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20"
                                    : split.isPaid
                                      ? "bg-emerald-500/10 text-emerald-600"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {isCurrentUser ? "Bạn" : split.user.displayName}{sharesLabel}: {formatVND(split.amount)}
                                {split.isPaid && " ✓"}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                        <p className="font-bold text-base">{formatVND(expense.amount)}</p>
                        <div className="flex items-center gap-1">
                          {canEditExpense(expense) && (
                            <Link
                              href={`/groups/${groupId}/expenses/${expense.id}/edit`}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "sm" }),
                                "h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 cursor-pointer"
                              )}
                            >
                              <Pencil className="h-3 w-3" />
                              Sửa
                            </Link>
                          )}
                          {canDeleteExpense(expense) && (
                            <ExpenseDeleteButton
                              expenseId={expense.id}
                              expenseTitle={expense.title}
                              amount={expense.amount}
                            />
                          )}
                          {isOwner && expense.status === "PENDING" && (
                            <ExpenseApproveButton expenseId={expense.id} />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 px-1">
              <span className="text-xs text-muted-foreground">
                Trang {currentPage} / {totalPages} (Tổng {processedTotal} hoá đơn đã duyệt)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1 || isNavigating}
                  className="h-8 gap-1 font-semibold text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages || isNavigating}
                  className="h-8 gap-1 font-semibold text-xs"
                >
                  Trang sau
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
