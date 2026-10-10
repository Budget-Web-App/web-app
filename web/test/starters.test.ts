import { describe, expect, it } from 'vitest';
import { starterAccounts, starterGroups } from '../src/starters';

const unique = (names: string[]) => new Set(names).size === names.length;

describe('starter data', () => {
  it('has unique group names', () => {
    expect(unique(starterGroups.map((group) => group.name))).toBe(true);
  });

  it('has unique category names across every group', () => {
    expect(unique(starterGroups.flatMap((group) => group.categories))).toBe(true);
  });

  it('has unique account names', () => {
    expect(unique(starterAccounts.map((account) => account.name))).toBe(true);
  });
});
