import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/user-select";
import { redirect } from "next/navigation";
import { JoinGroupButton } from "@/components/groups/join-group-button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Tham gia nhóm - GroupSplit",
};

export default async function JoinGroupPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await auth();

  if (!session) {
    redirect(`/login?callbackUrl=/groups/join/${code}`);
  }

  const userId = session.user.id!;

  const group = await prisma.group.findUnique({
    where: { inviteCode: code },
    include: {
      owner: { select: publicUserSelect },
      members: { include: { user: { select: publicUserSelect } } },
    },
  });

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="py-12">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-destructive opacity-70" />
            <h1 className="text-xl font-bold mb-2">Link không hợp lệ</h1>
            <p className="text-muted-foreground text-sm mb-6">
              Link mời này đã hết hạn hoặc không tồn tại
            </p>
            <Button asChild>
              <Link href="/dashboard">Về trang chủ</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alreadyMember = group.members.some((m) => m.userId === userId);

  if (alreadyMember) {
    redirect(`/groups/${group.id}`);
  }

  const pendingRequest = await prisma.groupJoinRequest.findFirst({
    where: {
      groupId: group.id,
      userId,
      status: "PENDING",
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 -z-10 [background:radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <Card className="w-full max-w-sm">
        <CardContent className="py-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-4 text-primary-foreground text-2xl font-bold">
            {group.name[0].toUpperCase()}
          </div>

          <h1 className="text-xl font-bold mb-1">{group.name}</h1>
          {group.description && (
            <p className="text-muted-foreground text-sm mb-3">{group.description}</p>
          )}

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
            <Users className="h-4 w-4" />
            {group.members.length} thành viên • Trưởng nhóm: {group.owner.displayName}
          </div>

          <JoinGroupButton groupId={group.id} initialPending={!!pendingRequest} />
        </CardContent>
      </Card>
    </div>
  );
}
