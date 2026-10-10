import type { ExternalAccount, ExternalTransaction, SyncProvider } from './types';

const CHECKING_REF = 'mock_checking';
const CREDIT_REF = 'mock_credit';

const checkingFeed: ExternalTransaction[] = [
  { externalId: 'chk-2026-10-02', accountRef: CHECKING_REF, postedAt: '2026-10-02', payee: 'ACME Payroll', amountMinor: 300000, currency: 'USD', cleared: true },
  { externalId: 'chk-2026-10-03', accountRef: CHECKING_REF, postedAt: '2026-10-03', payee: 'River City Coffee', amountMinor: -465, currency: 'USD', cleared: true },
  { externalId: 'chk-2026-10-04', accountRef: CHECKING_REF, postedAt: '2026-10-04', payee: 'Groceries R Us', amountMinor: -8750, currency: 'USD', cleared: true },
  { externalId: 'chk-2026-10-06', accountRef: CHECKING_REF, postedAt: '2026-10-06', payee: 'City Transit', amountMinor: -4500, currency: 'USD', cleared: true },
  { externalId: 'chk-2026-10-08', accountRef: CHECKING_REF, postedAt: '2026-10-08', payee: 'Utilities Co', amountMinor: -12000, currency: 'USD', cleared: true },
  { externalId: 'chk-2026-10-09', accountRef: CHECKING_REF, postedAt: '2026-10-09', payee: 'Co-op Pharmacy', amountMinor: -1580, currency: 'USD', cleared: false },
];

const creditFeed: ExternalTransaction[] = [
  { externalId: 'crd-2026-10-04', accountRef: CREDIT_REF, postedAt: '2026-10-04', payee: 'Fuel Stop', amountMinor: -3800, currency: 'USD', cleared: true },
  { externalId: 'crd-2026-10-06', accountRef: CREDIT_REF, postedAt: '2026-10-06', payee: 'Takeout Tonight', amountMinor: -1250, currency: 'USD', cleared: true },
  { externalId: 'crd-2026-10-09', accountRef: CREDIT_REF, postedAt: '2026-10-09', payee: 'Online Store', amountMinor: -5400, currency: 'USD', cleared: true },
];

const sumFeed = (feed: ExternalTransaction[]) =>
  feed.reduce((sum, t) => sum + t.amountMinor, 0);

const checkingAccount: ExternalAccount = {
  provider: 'mock',
  externalId: CHECKING_REF,
  name: 'Mock Checking',
  type: 'checking',
  balanceMinor: sumFeed(checkingFeed),
  currency: 'USD',
};

const creditAccount: ExternalAccount = {
  provider: 'mock',
  externalId: CREDIT_REF,
  name: 'Mock Credit Card',
  type: 'credit',
  balanceMinor: sumFeed(creditFeed),
  currency: 'USD',
};

export const mockProvider: SyncProvider = {
  id: 'mock',
  name: 'Mock Bank',
  async listAccounts() {
    return [checkingAccount, creditAccount];
  },
  async listTransactions(accountRef: string, since?: string) {
    const feed =
      accountRef === CHECKING_REF
        ? checkingFeed
        : accountRef === CREDIT_REF
          ? creditFeed
          : [];
    return since ? feed.filter((t) => t.postedAt >= since) : feed;
  },
};
