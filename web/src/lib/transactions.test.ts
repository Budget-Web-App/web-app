import { describe, expect, it } from 'vitest';
import type { Transaction } from './api';
import { incomeMinor } from './transactions';

function txn(over: Partial<Transaction>): Transaction {
  return {
    id: 'txn_1',
    budgetId: 'bud_1',
    accountId: 'acct_1',
    categoryId: null,
    payee: 'Paycheck',
    amountMinor: 1000,
    date: '2026-10-01',
    memo: null,
    cleared: 'uncleared',
    transferTransactionId: null,
    provider: null,
    externalId: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...over,
  };
}

describe('incomeMinor', () => {
  it('sums only positive, uncategorized, non-transfer money', () => {
    expect(
      incomeMinor([
        txn({ id: 'a', amountMinor: 1500 }),
        txn({ id: 'b', amountMinor: 500, categoryId: 'catg_1' }),
        txn({ id: 'c', amountMinor: -2000 }),
        txn({ id: 'd', amountMinor: 400, transferTransactionId: 'txn_2' }),
      ]),
    ).toBe(1500);
  });

  it('is zero when nothing counts as income', () => {
    expect(incomeMinor([])).toBe(0);
  });
});
