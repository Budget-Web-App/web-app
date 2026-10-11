import { MonthView } from '../../lib/api';

/** Setup is done when categories exist and their income is assigned down to zero. */
export function setupComplete(view: MonthView): boolean {
  const assigned = view.groups.reduce(
    (sum, group) => sum + group.categories.reduce((total, c) => total + c.allocatedMinor, 0),
    0,
  );
  const hasCategories = view.groups.some((group) => group.categories.length > 0);
  const hasIncome = view.readyToAssignMinor > 0 || assigned > 0;
  return hasCategories && hasIncome && view.readyToAssignMinor === 0;
}
