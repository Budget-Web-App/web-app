export interface ExternalAccount {
  provider: string;
  externalId: string;
  name: string;
  type: 'checking' | 'savings' | 'credit';
  balanceMinor: number;
  currency: string;
}

export interface ExternalTransaction {
  externalId: string;
  accountRef: string;
  postedAt: string;
  payee: string;
  amountMinor: number;
  currency: string;
  cleared: boolean;
}

export interface SyncProvider {
  id: string;
  name: string;
  listAccounts(credentials: unknown): Promise<ExternalAccount[]>;
  listTransactions(accountRef: string, since?: string): Promise<ExternalTransaction[]>;
}
