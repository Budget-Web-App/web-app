import { describe, expect, it } from 'vitest';
import { Category, CategoryGroup } from '../../lib/api';
import { categoryOptionGroups, isHiddenOption } from './categories';

function category(
  id: string,
  name: string,
  archived = false,
): Category {
  return {
    id,
    budgetId: 'bud_1',
    groupId: 'grp_1',
    name,
    sortOrder: 0,
    archived,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function group(id: string, name: string, categories: Category[]): CategoryGroup {
  return {
    id,
    budgetId: 'bud_1',
    name,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    categories,
  };
}

describe('categoryOptionGroups', () => {
  it('keeps non-archived categories and drops archived ones', () => {
    const groups = [
      group('grp_1', 'Everyday', [
        category('catg_1', 'Groceries'),
        category('catg_2', 'Old', true),
      ]),
    ];

    expect(categoryOptionGroups(groups)).toEqual([
      {
        id: 'grp_1',
        name: 'Everyday',
        options: [{ id: 'catg_1', name: 'Groceries' }],
      },
    ]);
  });

  it('drops a group whose categories are all archived', () => {
    const groups = [
      group('grp_1', 'Empty', [category('catg_1', 'Old', true)]),
      group('grp_2', 'Active', [category('catg_2', 'Rent')]),
    ];

    expect(categoryOptionGroups(groups).map((g) => g.id)).toEqual(['grp_2']);
  });
});

describe('isHiddenOption', () => {
  const groups = categoryOptionGroups([
    group('grp_1', 'Everyday', [category('catg_1', 'Groceries')]),
  ]);

  it('is false for a null category and a visible one', () => {
    expect(isHiddenOption(groups, null)).toBe(false);
    expect(isHiddenOption(groups, 'catg_1')).toBe(false);
  });

  it('is true for an archived or unknown category still assigned to a row', () => {
    expect(isHiddenOption(groups, 'catg_archived')).toBe(true);
  });
});
