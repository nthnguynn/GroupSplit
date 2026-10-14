import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatVND, formatDate } from "@/lib/utils/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Plus, Users, ArrowRight, Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils/format";

export const metadata = {
  title: "Nhóm của tôi - GroupSplit",
};

export default async function GroupsPage() {
  const session = await auth();
  const userId = session!.user.id!;

  let memberships: any[] = [];
  const totalSpendByGroup = new Map<string, number>();
  try {
    memberships = await prisma.groupMember.findMany({
      where: { userId, NOT: { isLeft: true } },
      select: {
        role: true,
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            avatar: true,
            createdAt: true,
            _count: { select: { members: { where: { isLeft: false } } } },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    // Tổng chi đã duyệt của từng nhóm — để DB cộng thay vì tải toàn bộ hóa đơn
    const totals = await prisma.expense.groupBy({
      by: ["groupId"],
      where: { groupId: { in: memberships.map((m) => m.group.id) }, status: "APPROVED" },
      _sum: { amount: true },
    });
    for (const t of totals) totalSpendByGroup.set(t.groupId, t._sum.amount ?? 0);
  } catch (err) {
    console.error("[GroupsPage] Lỗi lấy danh sách nhóm:", err);
    memberships = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nhóm của tôi</h1>
          <p className="text-muted-foreground text-sm">
            {memberships.length} nhóm đang tham gia
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/groups/new">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Tạo nhóm</span>
          </Link>
        </Button>
      </div>

      {memberships.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold mb-2">Chưa có nhóm nào</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Tạo nhóm mới hoặc yêu cầu bạn bè gửi link mời để bắt đầu
            </p>
            <Button asChild>
              <Link href="/groups/new">Tạo nhóm đầu tiên</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {memberships.map(({ group, role }: any) => {
            const totalSpend = totalSpendByGroup.get(group.id) ?? 0;
            const isOwner = role === "OWNER";
            const activeMembersCount = group._count.members;

            return (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <Card className="h-full hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border shadow-sm rounded-xl shrink-0">
                          {group.avatar && (
                            <AvatarImage src={group.avatar} alt={group.name} className="object-cover rounded-xl" />
                          )}
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold rounded-xl">
                            {getInitials(group.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">
                            {group.name}
                          </CardTitle>
                          {group.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {isOwner && (
                        <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                          <Crown className="h-3 w-3" />
                          Trưởng nhóm
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Thành viên</p>
                        <p className="font-semibold text-sm mt-0.5">
                          {activeMembersCount}
                        </p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Tổng chi</p>
                        <p className="font-semibold text-sm mt-0.5">
                          {totalSpend >= 1000000
                            ? `${(totalSpend / 1000000).toFixed(1)}M`
                            : totalSpend >= 1000
                            ? `${(totalSpend / 1000).toFixed(0)}K`
                            : formatVND(totalSpend)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Tạo {formatDate(group.createdAt)}</span>
                      <ArrowRight className="h-3.5 w-3.5 group-hover:text-foreground transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
