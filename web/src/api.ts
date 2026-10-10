export type Role = 'owner' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Budget {
  id: string;
  name: string;
  currency: string;
  ownerId: string;
  role: Role;
  createdAt: string;
}

export interface Member {
  userId: string;
  email: string;
  name: string;
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
  balanceMinor: number;
  provider: string | null;
  externalId: string | null;
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

export interface TransactionInput {
  accountId: string;
  payee: string;
  amountMinor: number;
  date: string;
  memo?: string;
  /** Set at most one of categoryId or transferAccountId. */
  categoryId?: string;
  transferAccountId?: string;
}

export interface TransactionPatch {
  payee?: string;
  amountMinor?: number;
  date?: string;
  memo?: string | null;
  cleared?: 'cleared' | 'uncleared';
  categoryId?: string | null;
  accountId?: string;
}

export interface SyncProvider {
  id: string;
  name: string;
}

export interface SyncResult {
  imported: number;
  ignored: number;
  matched: number;
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

export interface CategoryGroup {
  id: string;
  budgetId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  categories: Category[];
}

export interface MonthCategory {
  id: string;
  name: string;
  allocatedMinor: number;
  activityMinor: number;
  availableMinor: number;
}

export interface MonthGroup {
  id: string;
  name: string;
  categories: MonthCategory[];
}

export interface MonthView {
  month: string;
  readyToAssignMinor: number;
  groups: MonthGroup[];
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorMessage = (err: unknown): string =>
  err instanceof ApiError ? err.message : 'Something went wrong';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error =
      (body as { error?: { code: string; message: string; details?: unknown } })
        .error ?? { code: 'internal_error', message: 'Something went wrong' };
    throw new ApiError(error.code, error.message, error.details);
  }
  return body as T;
}

function json(method: string, data?: unknown): RequestInit {
  return {
    method,
    body: data === undefined ? undefined : JSON.stringify(data),
  };
}

export const api = {
  me: () => request<{ user: User }>('/api/me'),
  signup: (email: string, password: string, name: string) =>
    request<{ user: User }>(
      '/api/auth/signup',
      json('POST', { email, password, name }),
    ),
  login: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/login', json('POST', { email, password })),
  logout: () => request<void>('/api/auth/logout', json('POST')),

  listBudgets: () => request<{ budgets: Budget[] }>('/api/budgets'),
  createBudget: (name: string) =>
    request<{ budget: Budget }>('/api/budgets', json('POST', { name })),
  renameBudget: (id: string, name: string) =>
    request<{ budget: Budget }>(
      `/api/budgets/${id}`,
      json('PATCH', { name }),
    ),
  deleteBudget: (id: string) => request<void>(`/api/budgets/${id}`, json('DELETE')),

  listMembers: (budgetId: string) =>
    request<{ members: Member[] }>(`/api/budgets/${budgetId}/members`),
  addMember: (budgetId: string, email: string, role: Role) =>
    request<{ member: Member }>(
      `/api/budgets/${budgetId}/members`,
      json('POST', { email, role }),
    ),
  setMemberRole: (budgetId: string, userId: string, role: Role) =>
    request<{ member: Member }>(
      `/api/budgets/${budgetId}/members/${userId}`,
      json('PATCH', { role }),
    ),
  removeMember: (budgetId: string, userId: string) =>
    request<void>(
      `/api/budgets/${budgetId}/members/${userId}`,
      json('DELETE'),
    ),

  listAccounts: (budgetId: string) =>
    request<{ accounts: Account[] }>(`/api/budgets/${budgetId}/accounts`),
  createAccount: (budgetId: string, name: string, type: AccountType) =>
    request<{ account: Account }>(
      `/api/budgets/${budgetId}/accounts`,
      json('POST', { name, type }),
    ),
  closeAccount: (budgetId: string, accountId: string) =>
    request<{ account: Account }>(
      `/api/budgets/${budgetId}/accounts/${accountId}`,
      json('PATCH', { closed: true }),
    ),

  listGroups: (budgetId: string) =>
    request<{ groups: CategoryGroup[] }>(`/api/budgets/${budgetId}/category-groups`),
  createGroup: (budgetId: string, name: string) =>
    request<{ group: CategoryGroup }>(
      `/api/budgets/${budgetId}/category-groups`,
      json('POST', { name }),
    ),
  deleteGroup: (budgetId: string, groupId: string) =>
    request<void>(
      `/api/budgets/${budgetId}/category-groups/${groupId}`,
      json('DELETE'),
    ),
  createCategory: (budgetId: string, groupId: string, name: string) =>
    request<{ category: Category }>(
      `/api/budgets/${budgetId}/category-groups/${groupId}/categories`,
      json('POST', { name }),
    ),
  archiveCategory: (budgetId: string, categoryId: string) =>
    request<{ category: Category }>(
      `/api/budgets/${budgetId}/categories/${categoryId}`,
      json('PATCH', { archived: true }),
    ),

  getMonth: (budgetId: string, month: string) =>
    request<MonthView>(`/api/budgets/${budgetId}/months/${month}`),
  setAllocations: (
    budgetId: string,
    month: string,
    allocations: { categoryId: string; allocatedMinor: number }[],
  ) =>
    request<MonthView>(
      `/api/budgets/${budgetId}/months/${month}`,
      json('PUT', { allocations }),
    ),

  listTransactions: (
    budgetId: string,
    filters: { accountId?: string; month?: string } = {},
  ) => {
    const params = new URLSearchParams();
    if (filters.accountId) params.set('accountId', filters.accountId);
    if (filters.month) params.set('month', filters.month);
    const query = params.toString();
    return request<{ transactions: Transaction[] }>(
      `/api/budgets/${budgetId}/transactions${query ? `?${query}` : ''}`,
    );
  },
  createTransaction: (budgetId: string, input: TransactionInput) =>
    request<{ transactions: Transaction[] }>(
      `/api/budgets/${budgetId}/transactions`,
      json('POST', input),
    ),
  updateTransaction: (
    budgetId: string,
    transactionId: string,
    patch: TransactionPatch,
  ) =>
    request<{ transaction: Transaction }>(
      `/api/budgets/${budgetId}/transactions/${transactionId}`,
      json('PATCH', patch),
    ),
  deleteTransaction: (budgetId: string, transactionId: string) =>
    request<void>(
      `/api/budgets/${budgetId}/transactions/${transactionId}`,
      json('DELETE'),
    ),

  listSyncProviders: (budgetId: string) =>
    request<{ providers: SyncProvider[] }>(
      `/api/budgets/${budgetId}/sync/providers`,
    ),
  runSync: (budgetId: string, provider: string) =>
    request<SyncResult>(
      `/api/budgets/${budgetId}/sync/${provider}`,
      json('POST', {}),
    ),
};
