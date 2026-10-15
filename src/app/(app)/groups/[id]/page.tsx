export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { memberUserSelect } from "@/lib/user-select";
import { notFound, redirect } from "next/navigation";
import { formatVND, getInitials, generateInviteUrl } from "@/lib/utils/format";
import { summarizeBalances } from "@/lib/debt-calculator";
import { getGroupNetBalances } from "@/lib/group-balances";
import type { Prisma } from "@prisma/client";
import { GroupRealtimeListener } from "@/components/groups/group-realtime-listener";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import {
  Plus,
  Crown,
  Users,
  Settings,
} from "lucide-react";
import { InviteSection } from "@/components/groups/invite-section";
import { AddMemberForm } from "@/components/groups/add-member-form";
import { SettlementSection } from "@/components/groups/settlement-section";
import { ExpensesList } from "@/components/groups/expenses-list";
import { GroupBalanceSummary } from "@/components/groups/group-balance-summary";
import { FundManagerSettings } from "@/components/groups/fund-manager-settings";
import { FundAllocationTrigger } from "@/components/groups/fund-allocation-trigger";
import { FundAllocationsSection } from "@/components/groups/fund-allocations-section";
import { GroupFundSection } from "@/components/groups/group-fund-section";
import { MemberQRAction } from "@/components/groups/member-qr-action";
import { GroupSettingsForm } from "@/components/groups/group-settings-form";
import { LeaveGroupCard } from "@/components/groups/leave-group-card";
import { RemoveMemberButton } from "@/components/groups/remove-member-button";
import { DeleteGroupCard } from "@/components/groups/delete-group-card";
import { GroupSectionNav, parseGroupSection } from "@/components/groups/group-section-nav";

const userBrief = { select: { id: true, displayName: true, avatar: true } } as const;

const EXPENSES_PER_PAGE = 10;

// Trường hóa đơn mà danh sách hóa đơn / quỹ nhóm hiển thị.
// Không join User cho từng split/paidBy: Prisma gửi mỗi split một id trong `IN (...)` (không gộp trùng),
// trong khi tên đã có sẵn trong danh sách thành viên → gắn tên ở withMemberNames().
const expenseListSelect = {
  id: true,
  title: true,
  amount: true,
  splitType: true,
  status: true,
  date: true,
  createdAt: true,
  category: true,
  fundingSource: true,
  paidById: true,
  createdById: true,
  splits: {
    select: {
      id: true,
      userId: true,
      amount: true,
      shares: true,
      isPaid: true,
    },
  },
} satisfies Prisma.ExpenseSelect;

type ExpenseListRow = Prisma.ExpenseGetPayload<{ select: typeof expenseListSelect }>;
type MemberUser = { id: string; displayName: string; avatar: string | null };

/** Gắn paidBy / split.user (dạng client component cần) từ danh sách thành viên nhóm. */
function withMemberNames(expenses: ExpenseListRow[], usersById: Map<string, MemberUser>) {
  const brief = (userId: string) => {
    const user = usersById.get(userId);
    return { id: userId, displayName: user?.displayName ?? "Thành viên", avatar: user?.avatar ?? null };
  };
  return expenses.map((expense) => ({
    ...expense,
    paidBy: brief(expense.paidById),
    splits: expense.splits.map((split) => ({
      ...split,
      user: { id: split.userId, displayName: brief(split.userId).displayName },
    })),
  }));
}

function parseDateParam(value: string | string[] | undefined) {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Chỉ lấy đúng các trường client component dùng — dữ liệu này được serialize xuống trình duyệt.
// Hóa đơn KHÔNG tải ở đây: trang chỉ lấy phần cần hiển thị, số dư tính bằng SQL.
async function getGroupDetail(id: string) {
  // Client chỉ cần biết thành viên nào đã bật SePay (để tự xác nhận chuyển khoản),
  // nên chỉ lấy id — không tải giá trị secret.
  const sepayUsersQuery = prisma.user.findMany({
    where: {
      groupMemberships: { some: { groupId: id } },
      NOT: [{ sepayWebhookSecret: null }, { sepayWebhookSecret: "" }],
    },
    select: { id: true },
  });

  const groupQuery = prisma.group.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      avatar: true,
      zaloChatId: true,
      inviteCode: true,
      ownerId: true,
      fundManagerId: true,
      owner: { select: memberUserSelect },
      members: {
        include: { user: { select: memberUserSelect } },
        orderBy: { joinedAt: "asc" },
      },
      settlements: {
        include: { fromUser: userBrief, toUser: userBrief },
        orderBy: { createdAt: "desc" },
      },
      fundAllocations: {
        include: { fromUser: userBrief, toUser: userBrief },
        orderBy: { date: "desc" },
      },
      fundContributions: {
        include: { user: userBrief },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const [group, sepayUsers] = await Promise.all([groupQuery, sepayUsersQuery]);
  if (!group) return null;

  const sepayUserIds = new Set(sepayUsers.map((u) => u.id));
  return {
    ...group,
    members: group.members.map((m) => ({
      ...m,
      user: { ...m.user, hasSepay: sepayUserIds.has(m.userId) },
    })),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const group = await prisma.group.findUnique({ where: { id }, select: { name: true } });
    return { title: group ? `${group.name} - GroupSplit` : "Nhóm - GroupSplit" };
  } catch {
    return { title: "Nhóm - GroupSplit" };
  }
}

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; from?: string; to?: string; tab?: string }>;
}) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, auth()]);
  const userId = session!.user.id!;

  // Bộ lọc ngày (mốc ISO do client gửi theo giờ địa phương) và trang của danh sách hóa đơn
  const dateFrom = parseDateParam(query.from);
  const dateTo = parseDateParam(query.to);
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const activeSection = parseGroupSection(query.tab);
  const dateWhere: Prisma.ExpenseWhereInput =
    dateFrom || dateTo ? { date: { gte: dateFrom, lte: dateTo } } : {};
  const processedWhere: Prisma.ExpenseWhereInput = {
    groupId: id,
    status: { not: "PENDING" },
    ...dateWhere,
  };
  const getProcessedPage = (page: number) =>
    prisma.expense.findMany({
      where: processedWhere,
      select: expenseListSelect,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * EXPENSES_PER_PAGE,
      take: EXPENSES_PER_PAGE,
    });

  const [
    group,
    netBalances,
    pendingCount,
    pendingRows,
    processedTotal,
    requestedProcessedPage,
    fundExpenseRows,
  ] = await Promise.all([
    getGroupDetail(id),
    getGroupNetBalances(id),
    // Huy hiệu trên tab đếm mọi hóa đơn chờ duyệt; danh sách chỉ lấy phần khớp bộ lọc ngày
    prisma.expense.count({ where: { groupId: id, status: "PENDING" } }),
    prisma.expense.findMany({
      where: { groupId: id, status: "PENDING", ...dateWhere },
      select: expenseListSelect,
      orderBy: { createdAt: "desc" },
    }),
    prisma.expense.count({ where: processedWhere }),
    getProcessedPage(requestedPage),
    prisma.expense.findMany({
      where: { groupId: id, status: "APPROVED", fundingSource: "FUND" },
      select: expenseListSelect,
      orderBy: { date: "desc" },
    }),
  ]);

  if (!group) notFound();

  const activeMember = group.members.find((m) => m.userId === userId && !m.isLeft);
  if (!activeMember) redirect("/groups");

  const totalPages = Math.max(1, Math.ceil(processedTotal / EXPENSES_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const processedRows =
    currentPage === requestedPage ? requestedProcessedPage : await getProcessedPage(currentPage);

  const usersById = new Map(group.members.map((m) => [m.userId, m.user]));
  const pendingInRange = withMemberNames(pendingRows, usersById);
  const processedExpenses = withMemberNames(processedRows, usersById);
  const fundExpenses = withMemberNames(fundExpenseRows, usersById);

  const isOwner = group.ownerId === userId;
  const isFundManager =
    group.fundManagerId === userId ||
    (group.fundManagerId === null && group.ownerId === userId);

  // Số dư tính sẵn bằng SQL → cùng logic chia nợ với calculateDebts
  const balanceMap = new Map<string, number>();
  const nameMap = new Map<string, string>();
  for (const m of group.members) {
    balanceMap.set(m.userId, 0);
    nameMap.set(m.userId, m.user.displayName);
  }
  for (const [memberId, balance] of netBalances) {
    balanceMap.set(memberId, (balanceMap.get(memberId) ?? 0) + balance);
  }
  const { debts, balances } = summarizeBalances(balanceMap, nameMap, group.ownerId);

  const myBalance = balances.find((b) => b.userId === userId);

  const inviteUrl = generateInviteUrl(group.inviteCode);

  const activeMembersCount = group.members.filter((m) => !m.isLeft).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <GroupRealtimeListener groupId={id} />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarImage src={group.avatar || undefined} alt={group.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
              {getInitials(group.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
            {group.description && (
              <p className="text-muted-foreground text-sm">{group.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <FundAllocationTrigger
            groupId={id}
            isFundManager={isFundManager}
            members={group.members.filter((m) => !m.isLeft).map((m) => ({
              userId: m.userId,
              user: {
                id: m.user.id,
                displayName: m.user.displayName,
                avatar: m.user.avatar,
              },
            }))}
          />
          <Button asChild size="lg" className="gap-2 shrink-0 h-11 md:h-12 px-5 md:px-6 text-sm md:text-base font-bold shadow-md rounded-xl">
            <Link href={`/groups/${id}/expenses/new`}>
              <Plus className="h-5 w-5" />
              Tạo hóa đơn
            </Link>
          </Button>
        </div>
      </div>

      {/* Group Balance Summary (Lũy kế & Quỹ nhóm) */}
      <GroupBalanceSummary
        groupId={id}
        currentUserId={userId}
        myBalance={myBalance || { userId, balance: 0 }}
        myDebts={debts.filter((d) => d.fromUserId === userId)}
        myClaims={debts.filter((d) => d.toUserId === userId)}
        members={group.members.filter((m) => !m.isLeft) as any}
        settlements={group.settlements as any}
        fundAllocations={group.fundAllocations as any}
      />

      {/* Chỉ render section đang mở để không serialize dữ liệu của cả 6 tab. */}
      <div className="space-y-4">
        <GroupSectionNav
          groupId={id}
          activeSection={activeSection}
          pendingCount={pendingCount}
          searchParams={query}
        />

        {/* Tab 1: Expenses List */}
        {activeSection === "expenses" && <div className="space-y-4">
          <ExpensesList
            groupId={id}
            expenses={[...pendingInRange, ...processedExpenses] as any}
            processedTotal={processedTotal}
            currentPage={currentPage}
            totalPages={totalPages}
            dateFrom={dateFrom?.toISOString()}
            dateTo={dateTo?.toISOString()}
            settlements={group.settlements as any}
            currentUserId={userId}
            currentUserName={session!.user.name || ""}
            isOwner={isOwner}
          />
        </div>}

        {/* Tab 2: Settlement Section */}
        {activeSection === "settle" && <div className="space-y-4">
          <SettlementSection
            groupId={id}
            debts={debts}
            currentUserId={userId}
            owner={{
              id: group.owner.id,
              displayName: group.owner.displayName,
              bankName: group.owner.bankName,
              accountNumber: group.owner.accountNumber,
              accountName: group.owner.accountName,
            }}
            members={group.members.filter((m) => !m.isLeft) as any}
            settlements={group.settlements as any}
            fundManagerId={group.fundManagerId}
            fundAllocations={group.fundAllocations as any}
          />
        </div>}

        {/* Tab 3: Group Fund Section */}
        {activeSection === "group-fund" && <div className="space-y-4">
          <GroupFundSection
            groupId={id}
            groupName={group.name}
            currentUserId={userId}
            isOwner={isOwner}
            owner={{
              id: group.owner.id,
              displayName: group.owner.displayName,
              bankName: group.owner.bankName,
              accountNumber: group.owner.accountNumber,
              accountName: group.owner.accountName,
            }}
            fundContributions={group.fundContributions as any}
            expenses={fundExpenses as any}
            members={group.members.filter((m) => !m.isLeft) as any}
          />
        </div>}

        {/* Tab 4: Fund Allocations Section */}
        {activeSection === "funds" && <div className="space-y-4">
          <FundAllocationsSection
            groupId={id}
            fundAllocations={group.fundAllocations as any}
            members={group.members.filter((m) => !m.isLeft) as any}
            currentUserId={userId}
            isFundManager={isFundManager}
          />
        </div>}

        {/* Tab 3: Members Section */}
        {activeSection === "members" && <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Danh sách thành viên ({activeMembersCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.members.filter((m) => m && !m.isLeft && m.user).map((member) => {
                const memberBalance = balances.find((b) => b.userId === member.userId)?.balance ?? 0;
                const isMemberOwner = member.userId === group.ownerId;
                const isMemberFundManager = group.fundManagerId === member.userId;

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-10 w-10 border">
                        <AvatarImage src={member.user.avatar || undefined} alt={member.user.displayName} />
                        <AvatarFallback className="bg-muted text-foreground text-xs font-semibold">
                          {getInitials(member.user.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm truncate">{member.user.displayName}</p>
                          {isMemberOwner && (
                            <Badge variant="secondary" className="gap-1 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 shrink-0">
                              <Crown className="h-3 w-3" /> Trưởng nhóm
                            </Badge>
                          )}
                          {isMemberFundManager && !isMemberOwner && (
                            <Badge variant="secondary" className="gap-1 text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20 shrink-0">
                              Quản lý quỹ
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          @{member.user.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Thẻ hiển thị số dư lũy kế cá nhân */}
                      <Badge
                        variant={
                          memberBalance > 0.01
                            ? "default"
                            : memberBalance < -0.01
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs font-mono"
                      >
                        {memberBalance > 0.01
                          ? `+${formatVND(memberBalance)}`
                          : memberBalance < -0.01
                          ? formatVND(memberBalance)
                          : "0đ"}
                      </Badge>

                      {/* Nút hành động quét QR cá nhân */}
                      <MemberQRAction member={member as any} />

                      {/* Nút xóa thành viên (chỉ Trưởng nhóm có quyền xóa các thành viên khác) */}
                      {isOwner && !isMemberOwner && (
                        <RemoveMemberButton
                          groupId={id}
                          memberUserId={member.userId}
                          memberDisplayName={member.user.displayName}
                          memberBalance={memberBalance}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Mời & Thêm thành viên */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InviteSection inviteUrl={inviteUrl} inviteCode={group.inviteCode} />
            <AddMemberForm groupId={id} />
          </div>
        </div>}

        {/* Tab 4: Settings Section */}
        {activeSection === "settings" && <div className="space-y-4">
          {/* Cấu hình Quản lý quỹ */}
          {isOwner && (
            <FundManagerSettings
              groupId={id}
              currentFundManagerId={group.fundManagerId}
              members={group.members.filter((m) => !m.isLeft) as any}
            />
          )}

          {/* Cài đặt Nhóm */}
          {isOwner && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Thông tin & Cài đặt Nhóm
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GroupSettingsForm
                  group={{
                    id: group.id,
                    name: group.name,
                    description: group.description,
                    avatar: group.avatar,
                    zaloChatId: group.zaloChatId,
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Thẻ Giải tán / Xóa nhóm (cho Trưởng nhóm) hoặc Rời nhóm (cho thành viên) */}
          {isOwner ? (
            <DeleteGroupCard groupId={id} groupName={group.name} />
          ) : (
            <LeaveGroupCard groupId={id} groupName={group.name} />
          )}
        </div>}
      </div>
    </div>
  );
}
