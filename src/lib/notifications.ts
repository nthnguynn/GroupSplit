import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

interface CreateNotificationParams {
  userId: string;
  title: string;
  content: string;
  type: NotificationType;
  link?: string;
  entityId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        title: params.title,
        content: params.content,
        type: params.type,
        link: params.link,
        entityId: params.entityId,
      },
    });
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
}

export async function enrichNotifications(notifications: any[]) {
  const inviteIds = notifications
    .filter((n) => n.type === "GROUP_INVITE" && n.entityId)
    .map((n) => n.entityId as string);

  const joinRequestIds = notifications
    .filter((n) => n.type === "JOIN_REQUEST" && n.entityId)
    .map((n) => n.entityId as string);

  const [invitations, joinRequests] = await Promise.all([
    inviteIds.length > 0
      ? prisma.groupInvitation.findMany({
          where: { id: { in: inviteIds } },
          select: { id: true, status: true },
        })
      : [],
    joinRequestIds.length > 0
      ? prisma.groupJoinRequest.findMany({
          where: { id: { in: joinRequestIds } },
          select: { id: true, status: true },
        })
      : [],
  ]);

  const inviteMap = new Map(invitations.map((i) => [i.id, i.status]));
  const joinMap = new Map(joinRequests.map((j) => [j.id, j.status]));

  return notifications.map((n) => {
    let entityStatus: string | undefined = undefined;
    if (n.type === "GROUP_INVITE" && n.entityId) {
      entityStatus = inviteMap.get(n.entityId);
    } else if (n.type === "JOIN_REQUEST" && n.entityId) {
      entityStatus = joinMap.get(n.entityId);
    }
    return {
      ...n,
      entityStatus,
    };
  });
}
