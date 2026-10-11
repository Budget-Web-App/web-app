import type { Transaction } from './api';

/**
 * Income recorded in a set of transactions: positive, uncategorized money that
 * is not a transfer. Ready to assign and reports both ask how much arrived.
 */
export const incomeMinor = (transactions: Transaction[]): number =>
  transactions
    .filter((t) => t.categoryId === null && t.amountMinor > 0 && t.transferTransactionId === null)
    .reduce((sum, t) => sum + t.amountMinor, 0);
