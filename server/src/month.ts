import {
  earliestAllocationMonth,
  earliestTransactionMonth,
  getAllocation,
  listCategories,
  listCategoryGroups,
  listTransactions,
} from './store';

export interface MonthCategoryView {
  id: string;
  name: string;
  allocatedMinor: number;
  activityMinor: number;
  availableMinor: number;
}

export interface MonthGroupView {
  id: string;
  name: string;
  categories: MonthCategoryView[];
}

export interface MonthView {
  month: string;
  readyToAssignMinor: number;
  groups: MonthGroupView[];
}

export function prevMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  if (monthIndex === 1) return `${year - 1}-12`;
  return `${year}-${String(monthIndex - 1).padStart(2, '0')}`;
}

export function nextMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  if (monthIndex === 12) return `${year + 1}-01`;
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/** The first month in which any data exists, anchoring the available recursion. */
function earliestDataMonth(budgetId: string): string | null {
  const candidates = [
    earliestAllocationMonth(budgetId),
    earliestTransactionMonth(budgetId),
  ].filter(Boolean) as string[];
  return candidates.length ? candidates.sort()[0] : null;
}

function activity(budgetId: string, categoryId: string, month: string): number {
  return listTransactions(budgetId)
    .filter((t) => t.categoryId === categoryId && t.date.startsWith(month))
    .reduce((sum, t) => sum + t.amountMinor, 0);
}

function incomeForMonth(budgetId: string, month: string): number {
  return listTransactions(budgetId)
    .filter(
      (t) =>
        t.categoryId === null &&
        t.amountMinor > 0 &&
        t.date.startsWith(month) &&
        t.transferTransactionId === null,
    )
    .reduce((sum, t) => sum + t.amountMinor, 0);
}

/**
 * Available balance for a category in a month: previous available plus
 * allocated plus activity, carried forward from the first month with data.
 * Negative balances carry forward as the contract defines.
 */
function availableFor(
  budgetId: string,
  categoryId: string,
  month: string,
): number {
  const anchor = earliestDataMonth(budgetId);
  if (!anchor || month < anchor) return 0;
  let available = 0;
  let current = anchor;
  // Months are zero-padded YYYY-MM, so string comparison is chronological.
  while (current <= month) {
    available += getAllocation(categoryId, current) + activity(budgetId, categoryId, current);
    current = nextMonth(current);
  }
  return available;
}

/** Overspending carried from a month eats the next month's ready-to-assign. */
function overspendingCarry(budgetId: string, month: string): number {
  let carry = 0;
  for (const category of listCategories(budgetId)) {
    const available = availableFor(budgetId, category.id, month);
    if (available < 0) carry += -available;
  }
  return carry;
}

export function computeMonth(budgetId: string, month: string): MonthView {
  const groups: MonthGroupView[] = listCategoryGroups(budgetId).map((group) => ({
    id: group.id,
    name: group.name,
    categories: listCategories(budgetId, group.id)
      .filter((c) => !c.archived)
      .map((category) => ({
        id: category.id,
        name: category.name,
        allocatedMinor: getAllocation(category.id, month),
        activityMinor: activity(budgetId, category.id, month),
        availableMinor: availableFor(budgetId, category.id, month),
      })),
  }));

  const allocatedSum = groups.reduce(
    (sum, group) =>
      sum +
      group.categories.reduce((s, c) => s + c.allocatedMinor, 0),
    0,
  );

  // shortcut: overspending currently counts all negative categories; the
  // credit-account distinction arrives with transactions in phase 4.
  const readyToAssignMinor =
    incomeForMonth(budgetId, month) -
    allocatedSum -
    overspendingCarry(budgetId, prevMonth(month));

  return { month, readyToAssignMinor, groups };
}