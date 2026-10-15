import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatVND, formatDate } from "@/lib/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import {
  TrendingUp,
  Receipt,
  Wallet,
  Layers,
  Inbox,
  Users,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { getUserGroupBalances, type UserGroupBalance } from "@/lib/group-balances";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { SpendingDonutChart } from "@/components/dashboard/spending-donut-chart";
import { SpendingChart } from "@/components/dashboard/spending-chart";
import { startOfMonth, endOfMonth, format, addDays, addMonths } from "date-fns";
import type { Prisma } from "@prisma/client";

export const metadata = {
  title: "Quản lý Chi tiêu Cá nhân - GroupSplit",
};

// Nhãn trục thời gian của biểu đồ — tạo formatter một lần thay vì toLocaleDateString mỗi lần lặp
const monthKeyFormat = new Intl.DateTimeFormat("vi-VN", { month: "2-digit", year: "numeric" });
const dayKeyFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });
const RECENT_EXPENSES_LIMIT = 20;

const dashboardExpenseSelect = {
  id: true,
  title: true,
  amount: true,
  date: true,
  category: true,
  categoryId: true,
  groupId: true,
  paidById: true,
  group: { select: { name: true } },
  categoryRel: { select: { name: true, icon: true } },
  paidBy: { select: { displayName: true } },
  splits: {
    select: { amount: true },
  },
} satisfies Prisma.ExpenseSelect;

type DashboardExpense = Prisma.ExpenseGetPayload<{ select: typeof dashboardExpenseSelect }>;

interface SearchParams {
  from?: string;
  to?: string;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const userId = session!.user.id!;

  const resolvedParams = await searchParams;
  const fromStr = resolvedParams.from;
  const toStr = resolvedParams.to;

  // Xác định khoảng ngày: Mặc định là tháng hiện tại
  let startDate: Date;
  let endDate: Date;

  const today = new Date();
  if (fromStr) {
    startDate = new Date(fromStr);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate = startOfMonth(today);
    startDate.setHours(0, 0, 0, 0);
  }

  if (toStr) {
    endDate = new Date(toStr);
    endDate.setHours(23, 59, 59, 999);
  } else {
    endDate = endOfMonth(today);
    endDate.setHours(23, 59, 59, 999);
  }

  const formattedFrom = format(startDate, "yyyy-MM-dd");
  const formattedTo = format(endDate, "yyyy-MM-dd");

  // Độc lập với danh sách chi tiêu: khởi chạy sớm để không tạo waterfall DB.
  const groupBalancesPromise = getUserGroupBalances(userId).catch((err) => {
    console.error("[Dashboard] Lỗi tính số dư theo nhóm:", err);
    return [] as UserGroupBalance[];
  });

  // Truy vấn danh sách hóa đơn trong khoảng thời gian đã được duyệt (APPROVED) và người dùng có phần chia (split)
  let expenses: DashboardExpense[] = [];
  try {
    expenses = await prisma.expense.findMany({
      where: {
        status: "APPROVED",
        date: {
          gte: startDate,
          lte: endDate,
        },
        splits: {
          some: {
            userId,
          },
        },
      },
      select: {
        ...dashboardExpenseSelect,
        splits: {
          where: { userId },
          select: dashboardExpenseSelect.splits.select,
        },
      },
      orderBy: {
        date: "desc",
      },
    });
  } catch (err) {
    console.error("[Dashboard] Lỗi lấy danh sách expenses:", err);
    expenses = [];
  }

  // 1. Tính toán các chỉ số cơ bản (Key Metrics)
  const totalSpending = expenses.reduce((sum, exp) => {
    const myShare = exp.splits[0]?.amount ?? 0;
    return sum + myShare;
  }, 0);

  const transactionCount = expenses.length;
  // Dashboard chỉ cần bản xem nhanh. Số liệu và biểu đồ vẫn dùng toàn bộ giao dịch;
  // lịch sử đầy đủ có ở từng trang nhóm.
  const recentExpenses = expenses.slice(0, RECENT_EXPENSES_LIMIT);

  const daysDiff = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const dailyAverage = totalSpending / daysDiff;

  // 2. Thống kê theo Danh mục
  const categoryMap = new Map<string, { name: string; icon: string; amount: number }>();
  for (const expense of expenses) {
    const catId = expense.categoryId ?? expense.category ?? "Khác";
    const catName = expense.categoryRel?.name ?? expense.category ?? "Khác";
    const catIcon = expense.categoryRel?.icon ?? "📦";
    const myShare = expense.splits[0]?.amount ?? 0;

    const existing = categoryMap.get(catId) ?? {
      name: catName,
      icon: catIcon,
      amount: 0,
    };
    existing.amount += myShare;
    categoryMap.set(catId, existing);
  }

  const spendingByCategory = Array.from(categoryMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      icon: data.icon,
      amount: data.amount,
      percentage: totalSpending > 0 ? (data.amount / totalSpending) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // 3. Thống kê theo Nhóm
  const groupMap = new Map<string, { name: string; amount: number }>();
  for (const expense of expenses) {
    const groupId = expense.groupId;
    const groupName = expense.group.name;
    const myShare = expense.splits[0]?.amount ?? 0;

    const existing = groupMap.get(groupId) ?? {
      name: groupName,
      amount: 0,
    };
    existing.amount += myShare;
    groupMap.set(groupId, existing);
  }

  const spendingByGroup = Array.from(groupMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      amount: data.amount,
      percentage: totalSpending > 0 ? (data.amount / totalSpending) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // 4. Thống kê theo Thời gian (Dữ liệu biểu đồ)
  const isMonthly = daysDiff > 31;
  const timeMap = new Map<string, number>();

  if (isMonthly) {
    // Gom nhóm theo tháng: "MM/yyyy"
    let current = new Date(startDate);
    while (current <= endDate) {
      const key = monthKeyFormat.format(current);
      timeMap.set(key, 0);
      current = addMonths(current, 1);
    }

    for (const expense of expenses) {
      const key = monthKeyFormat.format(new Date(expense.date));
      if (timeMap.has(key)) {
        const myShare = expense.splits[0]?.amount ?? 0;
        timeMap.set(key, (timeMap.get(key) ?? 0) + myShare);
      }
    }
  } else {
    // Gom nhóm theo ngày: "dd/MM"
    let current = new Date(startDate);
    while (current <= endDate) {
      const key = dayKeyFormat.format(current);
      timeMap.set(key, 0);
      current = addDays(current, 1);
    }

    for (const expense of expenses) {
      const key = dayKeyFormat.format(new Date(expense.date));
      if (timeMap.has(key)) {
        const myShare = expense.splits[0]?.amount ?? 0;
        timeMap.set(key, (timeMap.get(key) ?? 0) + myShare);
      }
    }
  }

  const chartData = Array.from(timeMap.entries()).map(([label, amount]) => ({
    label,
    amount,
  }));

  // 5. Tính số tiền đang nợ hoặc cần được thanh toán theo nhóm (Lũy kế toàn thời gian)
  const groupBalances = await groupBalancesPromise;

  return (
    <div className="space-y-6">
      {/* Tiêu đề trang */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Quản lý chi tiêu cá nhân</h1>
        <p className="text-muted-foreground text-sm">
          Xin chào, <span className="font-medium text-foreground">{session!.user.name}</span>! Dưới đây là phân tích chi tiêu cá nhân của bạn.
        </p>
      </div>

      {/* Bộ lọc thời gian */}
      <DashboardFilters from={formattedFrom} to={formattedTo} />

      {/* Hàng thẻ thông tin chỉ số */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-primary/10 to-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Tổng chi tiêu cá nhân</p>
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-primary">
              {formatVND(totalSpending)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Phần chi của bạn trong khoảng thời gian này</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Trung bình hàng ngày</p>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-emerald-500">
              {formatVND(dailyAverage)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Tính cho {daysDiff} ngày được lọc</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500/10 to-blue-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Số lượng giao dịch</p>
              <Receipt className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-blue-500">
              {transactionCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Hóa đơn cá nhân đã tham gia chi tiêu</p>
          </CardContent>
        </Card>
      </div>

      {/* Lưới biểu đồ chính */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Biểu đồ xu hướng */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Xu hướng chi tiêu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingChart data={chartData} />
          </CardContent>
        </Card>

        {/* Cơ cấu theo danh mục */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Chi tiêu theo danh mục
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <SpendingDonutChart data={spendingByCategory} />
          </CardContent>
        </Card>
      </div>

      {/* Lưới chi tiết giao dịch và chi tiêu theo nhóm */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Tiến trình theo Nhóm */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Chi tiêu theo nhóm
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {spendingByGroup.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Không có dữ liệu chi tiêu theo nhóm
              </div>
            ) : (
              spendingByGroup.map((item) => (
                <div key={item.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[150px]">{item.name}</span>
                    <span className="font-semibold text-muted-foreground">
                      {formatVND(item.amount)} ({item.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <Progress value={item.percentage} className="h-2">
                    <ProgressTrack>
                      <ProgressIndicator className="bg-primary rounded-full animate-pulse-once" />
                    </ProgressTrack>
                  </Progress>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Lịch sử giao dịch chi tiết */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              Lịch sử chi tiêu chi tiết
            </CardTitle>
            <Badge variant="outline" className="text-xs font-normal">
              {recentExpenses.length === transactionCount
                ? `${transactionCount} giao dịch`
                : `${recentExpenses.length}/${transactionCount} gần nhất`}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {expenses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Inbox className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Không có giao dịch nào trong khoảng thời gian này 🎉</p>
              </div>
            ) : (
              <div className="max-h-[350px] overflow-y-auto pr-1 space-y-3 scrollbar-thin">
                {recentExpenses.map((exp) => {
                  const myShare = exp.splits[0]?.amount ?? 0;
                  const catIcon = exp.categoryRel?.icon ?? "📦";
                  const catName = exp.categoryRel?.name ?? exp.category ?? "Khác";
                  const isPaidByMe = exp.paidById === userId;

                  return (
                    <div
                      key={exp.id}
                      className="flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-accent/40 transition-colors"
                    >
                      {/* Icon */}
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0">
                        {catIcon}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{exp.title}</p>
                          <span className="text-xs text-muted-foreground shrink-0 font-mono">
                            {formatDate(exp.date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span className="truncate max-w-[120px] font-medium text-foreground/70">
                            {exp.group.name}
                          </span>
                          <span>•</span>
                          <span className="truncate">{catName}</span>
                          <span>•</span>
                          <span>
                            {isPaidByMe ? (
                              <span className="text-emerald-500 font-medium">Bạn trả trước</span>
                            ) : (
                              <span>{exp.paidBy.displayName} trả trước</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Amounts */}
                      <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                        <Badge variant="default" className="text-xs">
                          {formatVND(myShare)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          Tổng: {formatVND(exp.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Số dư nợ/Cần thanh toán theo nhóm */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Số dư nợ hoặc Cần thanh toán theo nhóm
          </CardTitle>
        </CardHeader>
        <CardContent>
          {groupBalances.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              Bạn chưa tham gia nhóm nào
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {groupBalances.map((item) => (
                <Link
                  key={item.groupId}
                  href={`/groups/${item.groupId}`}
                  className="flex items-center justify-between p-4 rounded-xl border bg-card hover:bg-accent/40 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {item.groupName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.balance > 0.01 ? (
                        <span className="text-emerald-500 font-medium">Bạn được nhận</span>
                      ) : item.balance < -0.01 ? (
                        <span className="text-rose-500 font-medium">Bạn cần trả</span>
                      ) : (
                        <span>Đã thanh toán xong</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        item.balance > 0.01
                          ? "default"
                          : item.balance < -0.01
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-xs"
                    >
                      {item.balance > 0.01
                        ? `+${formatVND(item.balance)}`
                        : item.balance < -0.01
                        ? formatVND(item.balance)
                        : "0đ"}
                    </Badge>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
