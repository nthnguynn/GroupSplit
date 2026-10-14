import { prisma } from "@/lib/prisma";

/**
 * Số dư net của mọi người trong một nhóm — cùng quy tắc với calculateDebts (xem bên dưới),
 * nhưng để DB tổng hợp thay vì tải toàn bộ hoá đơn/splits về server.
 */
export async function getGroupNetBalances(groupId: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ userId: string; balance: number }[]>`
    SELECT t."userId", SUM(t.delta)::float8 AS balance
    FROM (
      -- Mỗi split chưa trả: người được chia -amount, người chi +amount (quét splits một lần)
      SELECT v."userId", v.delta
      FROM "ExpenseSplit" s
      JOIN "Expense" e ON e.id = s."expenseId"
      CROSS JOIN LATERAL (VALUES (s."userId", -s.amount), (e."paidById", s.amount)) AS v("userId", delta)
      WHERE e."groupId" = ${groupId} AND e.status = 'APPROVED' AND e."fundingSource" <> 'FUND'
        AND s."isPaid" = false AND s."userId" <> e."paidById"
      UNION ALL
      SELECT e."paidById", e.amount
      FROM "Expense" e JOIN "Group" g ON g.id = e."groupId"
      WHERE e."groupId" = ${groupId} AND e.status = 'APPROVED' AND e."fundingSource" = 'FUND'
        AND e."paidById" <> g."ownerId"
      UNION ALL
      SELECT g."ownerId", -e.amount
      FROM "Expense" e JOIN "Group" g ON g.id = e."groupId"
      WHERE e."groupId" = ${groupId} AND e.status = 'APPROVED' AND e."fundingSource" = 'FUND'
        AND e."paidById" <> g."ownerId"
      UNION ALL
      SELECT st."fromUserId", st.amount FROM "Settlement" st
      WHERE st."groupId" = ${groupId} AND st."isConfirmed" = true
      UNION ALL
      SELECT st."toUserId", -st.amount FROM "Settlement" st
      WHERE st."groupId" = ${groupId} AND st."isConfirmed" = true
      UNION ALL
      SELECT fa."fromUserId", -fa.amount FROM "FundAllocation" fa WHERE fa."groupId" = ${groupId}
      UNION ALL
      SELECT fa."toUserId", fa.amount FROM "FundAllocation" fa WHERE fa."groupId" = ${groupId}
    ) t
    GROUP BY t."userId"
  `;
  return new Map(rows.map((r) => [r.userId, r.balance]));
}

export type UserGroupBalance = {
  groupId: string;
  groupName: string;
  balance: number; // dương = được nhận, âm = phải trả
};

/**
 * Số dư của một user trong từng nhóm đang tham gia, tính bằng SQL tổng hợp thay vì
 * tải toàn bộ hoá đơn/splits về rồi chạy calculateDebts. Phải khớp logic calculateDebts:
 *  - Hoá đơn APPROVED do thành viên chi: mỗi split chưa trả (isPaid = false) của người khác
 *    → người chi +amount, người được chia -amount.
 *  - Hoá đơn chi từ quỹ (FUND) do người khác Trưởng nhóm ứng → người ứng +amount, Trưởng nhóm -amount.
 *  - Settlement đã xác nhận: người chuyển +amount, người nhận -amount.
 *  - FundAllocation: người cấp -amount, người nhận +amount.
 */
export async function getUserGroupBalances(userId: string): Promise<UserGroupBalance[]> {
  return prisma.$queryRaw<UserGroupBalance[]>`
    WITH my_groups AS (
      SELECT g.id, g.name, g."ownerId", m."joinedAt"
      FROM "GroupMember" m
      JOIN "Group" g ON g.id = m."groupId"
      WHERE m."userId" = ${userId} AND m."isLeft" = false
    ),
    split_bal AS (
      SELECT e."groupId",
        SUM(CASE
          WHEN e."paidById" = ${userId} AND s."userId" <> ${userId} THEN s.amount
          WHEN s."userId" = ${userId} AND e."paidById" <> ${userId} THEN -s.amount
          ELSE 0
        END) AS amount
      FROM "Expense" e
      JOIN "ExpenseSplit" s ON s."expenseId" = e.id
      WHERE e."groupId" IN (SELECT id FROM my_groups)
        AND e.status = 'APPROVED'
        AND e."fundingSource" <> 'FUND'
        AND s."isPaid" = false
        AND (e."paidById" = ${userId} OR s."userId" = ${userId})
      GROUP BY e."groupId"
    ),
    fund_bal AS (
      SELECT e."groupId",
        SUM(CASE WHEN e."paidById" = ${userId} THEN e.amount ELSE 0 END)
          - SUM(CASE WHEN g."ownerId" = ${userId} THEN e.amount ELSE 0 END) AS amount
      FROM "Expense" e
      JOIN my_groups g ON g.id = e."groupId"
      WHERE e.status = 'APPROVED'
        AND e."fundingSource" = 'FUND'
        AND e."paidById" <> g."ownerId"
      GROUP BY e."groupId"
    ),
    settle_bal AS (
      SELECT st."groupId",
        SUM(CASE WHEN st."fromUserId" = ${userId} THEN st.amount ELSE 0 END)
          - SUM(CASE WHEN st."toUserId" = ${userId} THEN st.amount ELSE 0 END) AS amount
      FROM "Settlement" st
      WHERE st."groupId" IN (SELECT id FROM my_groups)
        AND st."isConfirmed" = true
        AND (st."fromUserId" = ${userId} OR st."toUserId" = ${userId})
      GROUP BY st."groupId"
    ),
    alloc_bal AS (
      SELECT fa."groupId",
        SUM(CASE WHEN fa."toUserId" = ${userId} THEN fa.amount ELSE 0 END)
          - SUM(CASE WHEN fa."fromUserId" = ${userId} THEN fa.amount ELSE 0 END) AS amount
      FROM "FundAllocation" fa
      WHERE fa."groupId" IN (SELECT id FROM my_groups)
        AND (fa."fromUserId" = ${userId} OR fa."toUserId" = ${userId})
      GROUP BY fa."groupId"
    )
    SELECT g.id AS "groupId",
      g.name AS "groupName",
      (COALESCE(sb.amount, 0) + COALESCE(fb.amount, 0) + COALESCE(stb.amount, 0) + COALESCE(ab.amount, 0))::float8 AS balance
    FROM my_groups g
    LEFT JOIN split_bal sb ON sb."groupId" = g.id
    LEFT JOIN fund_bal fb ON fb."groupId" = g.id
    LEFT JOIN settle_bal stb ON stb."groupId" = g.id
    LEFT JOIN alloc_bal ab ON ab."groupId" = g.id
    ORDER BY g."joinedAt" ASC
  `;
}
