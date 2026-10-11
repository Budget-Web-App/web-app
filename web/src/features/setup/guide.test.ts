import { describe, expect, it } from 'vitest';
import type { MonthView } from '../../lib/api';
import {
  Facts,
  accountNameProblem,
  assignTone,
  factsFrom,
  isStepDone,
  openingStep,
  previewReadyToAssign,
} from './guide';

const facts = (over: Partial<Facts> = {}): Facts => ({
  groups: 0,
  categories: 0,
  accounts: 0,
  readyMinor: 0,
  assignedMinor: 0,
  ...over,
});

describe('openingStep', () => {
  it('starts a blank budget at the idea', () => {
    expect(openingStep(facts())).toBe('welcome');
  });

  it('resumes at the first unfinished step', () => {
    expect(openingStep(facts({ groups: 1 }))).toBe('categories');
    expect(openingStep(facts({ groups: 1, categories: 2 }))).toBe('accounts');
    expect(openingStep(facts({ groups: 1, categories: 2, accounts: 1 }))).toBe('money');
    expect(openingStep(facts({ groups: 1, categories: 2, accounts: 1, readyMinor: 5000 }))).toBe('assign');
  });

  it('lands on the finish when everything is assigned', () => {
    const all = facts({ groups: 1, categories: 2, accounts: 1, assignedMinor: 5000 });
    expect(openingStep(all)).toBe('done');
  });
});

describe('isStepDone', () => {
  it('needs money and a zero Ready to Assign for the assign step', () => {
    expect(isStepDone('assign', facts({ categories: 1, readyMinor: 100 }))).toBe(false);
    expect(isStepDone('assign', facts({ categories: 1, assignedMinor: 100 }))).toBe(true);
    expect(isStepDone('assign', facts({ categories: 0, assignedMinor: 100 }))).toBe(false);
  });
});

describe('factsFrom', () => {
  it('counts groups, categories and assigned money', () => {
    const view: MonthView = {
      month: '2026-10',
      readyToAssignMinor: 300,
      groups: [
        {
          id: 'grp_1',
          name: 'A',
          categories: [
            { id: 'c1', name: 'x', allocatedMinor: 100, activityMinor: 0, availableMinor: 100 },
            { id: 'c2', name: 'y', allocatedMinor: 200, activityMinor: 0, availableMinor: 200 },
          ],
        },
        { id: 'grp_2', name: 'B', categories: [] },
      ],
    };
    expect(factsFrom(view, 2)).toEqual({
      groups: 2,
      categories: 2,
      accounts: 2,
      readyMinor: 300,
      assignedMinor: 300,
    });
  });
});

describe('assignTone', () => {
  it('describes where the person stands', () => {
    expect(assignTone(0, false)).toBe('empty');
    expect(assignTone(500, true)).toBe('todo');
    expect(assignTone(0, true)).toBe('done');
    expect(assignTone(-1, true)).toBe('over');
  });
});

describe('previewReadyToAssign', () => {
  it('applies unsaved edits and ignores unreadable ones', () => {
    const rows = [
      { savedMinor: 1000, draftMinor: 4000 },
      { savedMinor: 500, draftMinor: null },
      { savedMinor: 2000, draftMinor: 0 },
    ];
    expect(previewReadyToAssign(10000, rows)).toBe(10000 - 3000 + 2000);
  });
});

describe('accountNameProblem', () => {
  it('rejects blanks and case-insensitive duplicates', () => {
    expect(accountNameProblem('  ', [])).toMatch(/Enter/);
    expect(accountNameProblem('checking', ['Checking'])).toMatch(/already/);
    expect(accountNameProblem('Savings', ['Checking'])).toBeNull();
  });
});
