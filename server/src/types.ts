export type Role = 'owner' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface Budget {
  id: string;
  name: string;
  currency: string;
  ownerId: string;
  createdAt: string;
}

export interface Membership {
  budgetId: string;
  userId: string;
  role: Role;
  createdAt: string;
}

export type AccountType = 'checking' | 'savings' | 'credit';

export interface Account {
  id: string;
  budgetId: string;
  name: string;
  type: AccountType;
  closed: boolean;
  provider: string | null;
  externalId: string | null;
  createdAt: string;
}

export interface CategoryGroup {
  id: string;
  budgetId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

export interface Category {
  id: string;
  budgetId: string;
  groupId: string;
  name: string;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  budgetId: string;
  accountId: string;
  categoryId: string | null;
  payee: string;
  amountMinor: number;
  date: string;
  memo: string | null;
  cleared: 'cleared' | 'uncleared';
  transferTransactionId: string | null;
  provider: string | null;
  externalId: string | null;
  createdAt: string;
}
