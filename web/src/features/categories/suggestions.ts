import { starterGroups } from '../month/starters';

const extras = [
  'Insurance',
  'Medical',
  'Subscriptions',
  'Gifts',
  'Pets',
  'Clothing',
  'Car maintenance',
  'Home maintenance',
  'Fun money',
];

const pool = [...starterGroups.flatMap((group) => group.categories), ...extras];

/**
 * Category names worth offering while someone types a new one. Names already
 * used anywhere in the budget are skipped, and typing narrows the list.
 */
export function suggestCategoryNames(typed: string, taken: string[], limit = 4): string[] {
  const used = new Set(taken.map((name) => name.trim().toLowerCase()));
  const query = typed.trim().toLowerCase();
  return pool
    .filter((name) => {
      const key = name.toLowerCase();
      return !used.has(key) && key !== query && (query === '' || key.includes(query));
    })
    .slice(0, limit);
}
