import { randomBytes, randomUUID } from 'node:crypto';
import { config } from './config';
import type {
  Account,
  AccountType,
  Budget,
  Category,
  CategoryGroup,
  Membership,
  Role,
  Session,
  Transaction,
  User,
} from './types';

/**
 * In-memory store. The API contract is what matters; swapping this module for a
 * real database later does not change any route or response shape.
 */
const users = new Map<string, User>();
const userIdByEmail = new Map<string, string>();
const sessions = new Map<string, Session>();
const budgets = new Map<string, Budget>();
const memberships = new Map<string, Membership>();
const accounts = new Map<string, Account>();
const categoryGroups = new Map<string, CategoryGroup>();
const categories = new Map<string, Category>();
const allocations = new Map<string, number>();
const transactions = new Map<string, Transaction>();

export const membershipKey = (budgetId: string, userId: string) =>
  `${budgetId}:${userId}`;

export function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
}): User {
  const user: User = {
    id: `usr_${randomUUID()}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  users.set(user.id, user);
  userIdByEmail.set(user.email, user.id);
  return user;
}

export function getUserByEmail(email: string): User | undefined {
  const id = userIdByEmail.get(email);
  return id ? users.get(id) : undefined;
}

export function getUserById(id: string): User | undefined {
  return users.get(id);
}

export function createSession(userId: string): Session {
  const session: Session = {
    token: randomBytes(32).toString('base64url'),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + config.sessionTtlMs).toISOString(),
  };
  sessions.set(session.token, session);
  return session;
}

export function getSession(token: string): Session | undefined {
  const session = sessions.get(token);
  if (!session) return undefined;
  if (Date.parse(session.expiresAt) <= Date.now()) {
    sessions.delete(token);
    return undefined;
  }
  return session;
}

export function destroySession(token: string | undefined): void {
  if (token) sessions.delete(token);
}

export function createBudget(input: {
  name: string;
  currency: string;
  ownerId: string;
}): Budget {
  const budget: Budget = {
    id: `bud_${randomUUID()}`,
    ...input,
    createdAt: new Date().toISOString(),
  };
  budgets.set(budget.id, budget);
  setMembership(budget.id, input.ownerId, 'owner');
  return budget;
}

export function getBudget(id: string): Budget | undefined {
  return budgets.get(id);
}

export function deleteBudget(id: string): void {
  budgets.delete(id);
  for (const key of memberships.keys()) {
    if (key.startsWith(`${id}:`)) memberships.delete(key);
  }
}

export function getMembership(
  budgetId: string,
  userId: string,
): Membership | undefined {
  return memberships.get(membershipKey(budgetId, userId));
}

export function setMembership(
  budgetId: string,
  userId: string,
  role: Role,
): Membership {
  const key = membershipKey(budgetId, userId);
  const existing = memberships.get(key);
  const membership: Membership = existing
    ? { ...existing, role }
    : { budgetId, userId, role, createdAt: new Date().toISOString() };
  memberships.set(key, membership);
  return membership;
}

export function removeMembership(budgetId: string, userId: string): void {
  memberships.delete(membershipKey(budgetId, userId));
}

export function listMembershipsForUser(userId: string): Membership[] {
  return [...memberships.values()].filter((m) => m.userId === userId);
}

export function listMembershipsForBudget(budgetId: string): Membership[] {
  return [...memberships.values()].filter((m) => m.budgetId === budgetId);
}

export function countOwners(budgetId: string): number {
  return listMembershipsForBudget(budgetId).filter((m) => m.role === 'owner')
    .length;
}

export const allocationKey = (categoryId: string, month: string) =>
  `${categoryId}:${month}`;

function nextSortOrder(values: number[]): number {
  return values.reduce((max, value) => Math.max(max, value), 0) + 1;
}

export function createAccount(input: {
  budgetId: string;
  name: string;
  type: AccountType;
  provider?: string | null;
  externalId?: string | null;
}): Account {
  const account: Account = {
    id: `acct_${randomUUID()}`,
    budgetId: input.budgetId,
    name: input.name,
    type: input.type,
    closed: false,
    provider: input.provider ?? null,
    externalId: input.externalId ?? null,
    createdAt: new Date().toISOString(),
  };
  accounts.set(account.id, account);
  return account;
}

export function getAccount(budgetId: string, accountId: string): Account | undefined {
  const account = accounts.get(accountId);
  return account && account.budgetId === budgetId ? account : undefined;
}

export function listAccounts(budgetId: string): Account[] {
  return [...accounts.values()].filter((a) => a.budgetId === budgetId);
}

export function updateAccount(
  budgetId: string,
  accountId: string,
  patch: { name?: string; closed?: boolean },
): Account {
  const account = getAccount(budgetId, accountId);
  if (!account) throw new Error(`No such account: ${accountId}`);
  if (patch.name !== undefined) account.name = patch.name;
  if (patch.closed !== undefined) account.closed = patch.closed;
  return account;
}

export function createCategoryGroup(budgetId: string, name: string): CategoryGroup {
  const group: CategoryGroup = {
    id: `grp_${randomUUID()}`,
    budgetId,
    name,
    sortOrder: nextSortOrder(listCategoryGroups(budgetId).map((g) => g.sortOrder)),
    createdAt: new Date().toISOString(),
  };
  categoryGroups.set(group.id, group);
  return group;
}

export function getCategoryGroup(budgetId: string, groupId: string): CategoryGroup | undefined {
  const group = categoryGroups.get(groupId);
  return group && group.budgetId === budgetId ? group : undefined;
}

export function listCategoryGroups(budgetId: string): CategoryGroup[] {
  return [...categoryGroups.values()]
    .filter((g) => g.budgetId === budgetId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function updateCategoryGroup(budgetId: string, groupId: string, name: string): CategoryGroup {
  const group = getCategoryGroup(budgetId, groupId);
  if (!group) throw new Error(`No such group: ${groupId}`);
  group.name = name;
  return group;
}

/** Deleting a group removes its categories and their allocations. */
export function deleteCategoryGroup(budgetId: string, groupId: string): void {
  if (!getCategoryGroup(budgetId, groupId)) return;
  for (const category of listCategories(budgetId, groupId)) {
    deleteCategory(budgetId, category.id);
  }
  categoryGroups.delete(groupId);
}

export function createCategory(budgetId: string, groupId: string, name: string): Category {
  const category: Category = {
    id: `catg_${randomUUID()}`,
    budgetId,
    groupId,
    name,
    sortOrder: nextSortOrder(listCategories(budgetId, groupId).map((c) => c.sortOrder)),
    archived: false,
    createdAt: new Date().toISOString(),
  };
  categories.set(category.id, category);
  return category;
}

export function getCategory(budgetId: string, categoryId: string): Category | undefined {
  const category = categories.get(categoryId);
  return category && category.budgetId === budgetId ? category : undefined;
}

export function listCategories(budgetId: string, groupId?: string): Category[] {
  return [...categories.values()]
    .filter(
      (c) =>
        c.budgetId === budgetId && (groupId === undefined || c.groupId === groupId),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function updateCategory(
  budgetId: string,
  categoryId: string,
  patch: { name?: string; archived?: boolean },
): Category {
  const category = getCategory(budgetId, categoryId);
  if (!category) throw new Error(`No such category: ${categoryId}`);
  if (patch.name !== undefined) category.name = patch.name;
  if (patch.archived !== undefined) category.archived = patch.archived;
  return category;
}

export function deleteCategory(budgetId: string, categoryId: string): void {
  if (!getCategory(budgetId, categoryId)) return;
  for (const key of allocations.keys()) {
    if (key.startsWith(`${categoryId}:`)) allocations.delete(key);
  }
  categories.delete(categoryId);
}

export function setAllocation(categoryId: string, month: string, allocatedMinor: number): void {
  allocations.set(allocationKey(categoryId, month), allocatedMinor);
}

export function getAllocation(categoryId: string, month: string): number {
  return allocations.get(allocationKey(categoryId, month)) ?? 0;
}

export function earliestAllocationMonth(budgetId: string): string | null {
  let earliest: string | null = null;
  for (const [key] of allocations) {
    const [categoryId, month] = key.split(':');
    const category = categories.get(categoryId);
    if (!category || category.budgetId !== budgetId) continue;
    if (earliest === null || month < earliest) earliest = month;
  }
  return earliest;
}

export function earliestTransactionMonth(budgetId: string): string | null {
  let earliest: string | null = null;
  for (const transaction of transactions.values()) {
    if (transaction.budgetId !== budgetId) continue;
    const month = transaction.date.slice(0, 7);
    if (earliest === null || month < earliest) earliest = month;
  }
  return earliest;
}

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  month?: string;
}

export function listTransactions(
  budgetId: string,
  filters?: TransactionFilters,
): Transaction[] {
  return [...transactions.values()]
    .filter(
      (t) =>
        t.budgetId === budgetId &&
        (filters?.accountId === undefined || t.accountId === filters.accountId) &&
        (filters?.categoryId === undefined || t.categoryId === filters.categoryId) &&
        (filters?.month === undefined || t.date.slice(0, 7) === filters.month),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
}

export function createTransaction(input: {
  budgetId: string;
  accountId: string;
  categoryId: string | null;
  payee: string;
  amountMinor: number;
  date: string;
  memo?: string | null;
  cleared?: 'cleared' | 'uncleared';
  transferTransactionId?: string | null;
  provider?: string | null;
  externalId?: string | null;
}): Transaction {
  const transaction: Transaction = {
    id: `txn_${randomUUID()}`,
    budgetId: input.budgetId,
    accountId: input.accountId,
    categoryId: input.categoryId,
    payee: input.payee,
    amountMinor: input.amountMinor,
    date: input.date,
    memo: input.memo ?? null,
    cleared: input.cleared ?? 'uncleared',
    transferTransactionId: input.transferTransactionId ?? null,
    provider: input.provider ?? null,
    externalId: input.externalId ?? null,
    createdAt: new Date().toISOString(),
  };
  transactions.set(transaction.id, transaction);
  return transaction;
}

export function getTransaction(
  budgetId: string,
  transactionId: string,
): Transaction | undefined {
  const transaction = transactions.get(transactionId);
  return transaction && transaction.budgetId === budgetId
    ? transaction
    : undefined;
}

export function deleteTransaction(budgetId: string, transactionId: string): void {
  if (!getTransaction(budgetId, transactionId)) return;
  transactions.delete(transactionId);
}

export function deleteTransactions(budgetId: string, ids: string[]): void {
  for (const id of ids) deleteTransaction(budgetId, id);
}

export function updateTransaction(
  budgetId: string,
  transactionId: string,
  patch: {
    payee?: string;
    amountMinor?: number;
    date?: string;
    memo?: string | null;
    cleared?: 'cleared' | 'uncleared';
    categoryId?: string | null;
    accountId?: string;
  },
): Transaction {
  const transaction = getTransaction(budgetId, transactionId);
  if (!transaction) throw new Error(`No such transaction: ${transactionId}`);
  if (patch.payee !== undefined) transaction.payee = patch.payee;
  if (patch.amountMinor !== undefined) transaction.amountMinor = patch.amountMinor;
  if (patch.date !== undefined) transaction.date = patch.date;
  if (patch.memo !== undefined) transaction.memo = patch.memo;
  if (patch.cleared !== undefined) transaction.cleared = patch.cleared;
  if (patch.categoryId !== undefined) transaction.categoryId = patch.categoryId;
  if (patch.accountId !== undefined) transaction.accountId = patch.accountId;
  return transaction;
}

export function findTransactionByExternalId(
  budgetId: string,
  provider: string,
  externalId: string,
): Transaction | undefined {
  for (const t of transactions.values()) {
    if (
      t.budgetId === budgetId &&
      t.provider === provider &&
      t.externalId === externalId
    ) {
      return t;
    }
  }
  return undefined;
}

/** A hand-entered row (provider null) matching the candidate on the same account. */
export function findDuplicateTransaction(
  budgetId: string,
  candidate: { accountId: string; date: string; amountMinor: number; payee: string },
): Transaction | undefined {
  for (const t of transactions.values()) {
    if (
      t.budgetId === budgetId &&
      t.provider === null &&
      t.accountId === candidate.accountId &&
      t.date === candidate.date &&
      t.amountMinor === candidate.amountMinor &&
      t.payee === candidate.payee
    ) {
      return t;
    }
  }
  return undefined;
}

export function accountBalanceMinor(budgetId: string, accountId: string): number {
  return listTransactions(budgetId, { accountId }).reduce(
    (sum, t) => sum + t.amountMinor,
    0,
  );
}

/** Clear all state. Tests call this between cases. */
export function resetStore(): void {
  users.clear();
  userIdByEmail.clear();
  sessions.clear();
  budgets.clear();
  memberships.clear();
  accounts.clear();
  categoryGroups.clear();
  categories.clear();
  allocations.clear();
  transactions.clear();
}
