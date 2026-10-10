import { CategoryGroup } from './api';

export interface CategoryOption {
  id: string;
  name: string;
}

export interface CategoryOptionGroup {
  id: string;
  name: string;
  options: CategoryOption[];
}

/** Builds picker groups from non-archived categories, dropping empty groups. */
export function categoryOptionGroups(
  groups: CategoryGroup[],
): CategoryOptionGroup[] {
  return groups
    .map((group) => ({
      id: group.id,
      name: group.name,
      options: group.categories
        .filter((category) => !category.archived)
        .map((category) => ({ id: category.id, name: category.name })),
    }))
    .filter((group) => group.options.length > 0);
}

/** True when `id` has no option to match, so the picker must add one. */
export function isHiddenOption(
  groups: CategoryOptionGroup[],
  id: string | null,
): boolean {
  if (!id) return false;
  return !groups.some((group) =>
    group.options.some((option) => option.id === id),
  );
}
