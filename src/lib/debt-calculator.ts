/**
 * Tính toán "ai nợ ai" từ danh sách expenses
 * Gom dòng tiền qua Trưởng nhóm (Owner): mọi thành viên chỉ nợ hoặc được nợ bởi Trưởng nhóm.
 */

export type DebtEntry = {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
};

export type UserBalance = {
  userId: string;
  userName: string;
  balance: number; // dương = được nhận, âm = phải trả
};

export function calculateDebts(
  expenses: Array<{
    id: string;
    amount: number;
    paidById: string;
    fundingSource?: string;
    splits: Array<{
      userId: string;
      amount: number;
      isPaid: boolean;
    }>;
  }>,
  members: Array<{ userId: string; user: { id: string; displayName: string } }>,
  settlements: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
    isConfirmed: boolean;
  }>,
  ownerId: string,
  fundAllocations?: Array<{
    fromUserId: string;
    toUserId: string;
    amount: number;
  }>
): { debts: DebtEntry[]; balances: UserBalance[] } {
  // Tính balance net cho mỗi người
  const balanceMap: Map<string, number> = new Map();
  const nameMap: Map<string, string> = new Map();

  // Khởi tạo balance = 0 cho tất cả member
  for (const member of members) {
    balanceMap.set(member.userId, 0);
    nameMap.set(member.userId, member.user.displayName);
  }

  // Cộng/trừ từ expenses
  for (const expense of expenses) {
    if (expense.fundingSource === "FUND") {
      // Chi từ Quỹ nhóm:
      // Các thành viên thụ hưởng không nợ ai (vì quỹ đài thọ).
      // Nếu thành viên khác bỏ tiền túi ra chi thay cho quỹ (paidById !== ownerId),
      // thì Trưởng nhóm (người giữ quỹ) nợ thành viên đó khoản tiền tương ứng để hoàn lại tiền túi.
      if (expense.paidById !== ownerId) {
        const creditorBalance = balanceMap.get(expense.paidById) ?? 0;
        const debtorBalance = balanceMap.get(ownerId) ?? 0;
        balanceMap.set(expense.paidById, creditorBalance + expense.amount);
        balanceMap.set(ownerId, debtorBalance - expense.amount);
      }
      continue;
    }

    for (const split of expense.splits) {
      if (split.isPaid) continue;

      if (split.userId === expense.paidById) {
        // Người trả không nợ chính mình
        continue;
      }

      // split.userId nợ paidById số tiền split.amount
      const debtorBalance = balanceMap.get(split.userId) ?? 0;
      const creditorBalance = balanceMap.get(expense.paidById) ?? 0;

      balanceMap.set(split.userId, debtorBalance - split.amount);
      balanceMap.set(expense.paidById, creditorBalance + split.amount);
    }
  }

  // Trừ đi các settlements đã confirmed
  for (const settlement of settlements) {
    if (!settlement.isConfirmed) continue;
    const fromBalance = balanceMap.get(settlement.fromUserId) ?? 0;
    balanceMap.set(settlement.fromUserId, fromBalance + settlement.amount);

    const toBalance = balanceMap.get(settlement.toUserId) ?? 0;
    balanceMap.set(settlement.toUserId, toBalance - settlement.amount);
  }

  // Điều chỉnh balance từ fundAllocations (Người quản lý quỹ cấp tiền cho thành viên)
  if (fundAllocations) {
    for (const allocation of fundAllocations) {
      // 1. Trừ tiền người phát quỹ
      const fromBalance = balanceMap.get(allocation.fromUserId) ?? 0;
      balanceMap.set(allocation.fromUserId, fromBalance - allocation.amount);

      // 2. Cộng tiền người nhận quỹ (đọc lại giá trị mới nhất để tránh đè nếu trùng ID)
      const toBalance = balanceMap.get(allocation.toUserId) ?? 0;
      balanceMap.set(allocation.toUserId, toBalance + allocation.amount);
    }
  }

  return summarizeBalances(balanceMap, nameMap, ownerId);
}

/**
 * Từ số dư net của từng người → danh sách balances và các khoản nợ gom về Trưởng nhóm.
 * Dùng chung cho calculateDebts và cho số dư tính sẵn bằng SQL (getGroupNetBalances).
 */
export function summarizeBalances(
  balanceMap: Map<string, number>,
  nameMap: Map<string, string>,
  ownerId: string
): { debts: DebtEntry[]; balances: UserBalance[] } {
  // Build balance array
  const balances: UserBalance[] = Array.from(balanceMap.entries()).map(
    ([userId, balance]) => ({
      userId,
      userName: nameMap.get(userId) ?? userId,
      balance,
    })
  );

  // Gom toàn bộ dư nợ về Trưởng nhóm (ownerId)
  const debts: DebtEntry[] = [];
  const ownerName = nameMap.get(ownerId) ?? "Trưởng nhóm";

  for (const b of balances) {
    if (b.userId === ownerId) continue;

    if (b.balance < -0.01) {
      // Thành viên b nợ Trưởng nhóm
      debts.push({
        fromUserId: b.userId,
        fromUserName: b.userName,
        toUserId: ownerId,
        toUserName: ownerName,
        amount: Math.round(Math.abs(b.balance)),
      });
    } else if (b.balance > 0.01) {
      // Trưởng nhóm nợ thành viên b
      debts.push({
        fromUserId: ownerId,
        fromUserName: ownerName,
        toUserId: b.userId,
        toUserName: b.userName,
        amount: Math.round(b.balance),
      });
    }
  }

  return { debts, balances };
}
