export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/user-select";
import { notFound, redirect } from "next/navigation";
import { AddExpenseForm } from "@/components/expenses/add-expense-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils/format";

export const metadata = {
  title: "Sửa hoá đơn - GroupSplit",
};

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [group, expense] = await Promise.all([
    prisma.group.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: publicUserSelect } }, orderBy: { joinedAt: "asc" } },
      },
    }),
    prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        splits: true,
      },
    }),
  ]);

  if (!group || !expense) notFound();

  // Kiểm tra hoá đơn có thuộc đúng nhóm không
  if (expense.groupId !== id) notFound();

  const isOwner = group.ownerId === userId;
  const isMember = group.members.some((m) => m.userId === userId && !m.isLeft);
  if (!isOwner && !isMember) redirect("/groups");

  const isCreator = expense.createdById === userId;

  if (!isOwner && !isCreator) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Không có quyền chỉnh sửa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Bạn không phải là người tạo hoá đơn này và cũng không phải là Trưởng nhóm.
            </p>
            <Button asChild variant="outline">
              <Link href={`/groups/${id}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Quay lại nhóm
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Kiểm tra xem hoá đơn đã phát sinh thanh toán nợ liên quan chưa
  const debtorIds = expense.splits
    .map((s) => s.userId)
    .filter((uid) => uid !== expense.paidById);

  const confirmedSettlement = debtorIds.length > 0
    ? await prisma.settlement.findFirst({
        where: {
          groupId: id,
          isConfirmed: true,
          createdAt: { gte: expense.createdAt },
          OR: [
            { fromUserId: expense.paidById, toUserId: { in: debtorIds } },
            { fromUserId: { in: debtorIds }, toUserId: expense.paidById },
          ],
        },
        select: { id: true },
      })
    : null;

  const isLocked = !!confirmedSettlement;

  if (isLocked) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Hoá đơn đã bị khoá chỉnh sửa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">
              Hoá đơn <strong>&quot;{expense.title}&quot;</strong> đã phát sinh khoản thanh toán nợ liên quan giữa người chi trả và các thành viên chia tiền.
            </p>
            <p className="text-xs text-muted-foreground">
              Nhằm đảm bảo tính chính xác và toàn vẹn của sổ nợ và các giao dịch chuyển tiền đã được xác nhận, hoá đơn này không thể chỉnh sửa hoặc xoá được nữa.
            </p>
            <Button asChild variant="default" className="mt-2">
              <Link href={`/groups/${id}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Quay lại nhóm
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chỉnh sửa hoá đơn</h1>
          <p className="text-muted-foreground text-sm">
            Nhóm: <span className="font-medium text-foreground">{group.name}</span>
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/groups/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Quay lại
          </Link>
        </Button>
      </div>

      <AddExpenseForm
        groupId={id}
        members={group.members
          .filter((m) => !m.isLeft)
          .map((m) => ({
            userId: m.userId,
            displayName: m.user.displayName,
            avatar: m.user.avatar,
          }))}
        currentUserId={userId}
        initialExpense={{
          id: expense.id,
          title: expense.title,
          description: expense.description,
          amount: expense.amount,
          splitType: expense.splitType,
          date: expense.date.toISOString(),
          category: expense.category,
          categoryId: expense.categoryId,
          paidById: expense.paidById,
          fundingSource: expense.fundingSource,
          createdAt: expense.createdAt.toISOString(),
          splits: expense.splits.map((s) => ({
            id: s.id,
            userId: s.userId,
            amount: s.amount,
            shares: s.shares,
          })),
        }}
      />
    </div>
  );
}
