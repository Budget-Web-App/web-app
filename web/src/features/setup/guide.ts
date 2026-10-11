import type { MonthView } from '../../lib/api';

export type StepId = 'welcome' | 'groups' | 'categories' | 'accounts' | 'money' | 'assign' | 'done';

export const STEPS: { id: StepId; label: string }[] = [
  { id: 'welcome', label: 'Idea' },
  { id: 'groups', label: 'Groups' },
  { id: 'categories', label: 'Categories' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'money', label: 'Money' },
  { id: 'assign', label: 'Assign' },
  { id: 'done', label: 'Finish' },
];

/** What exists in the budget right now. Every step's "done" state derives from this. */
export interface Facts {
  groups: number;
  categories: number;
  accounts: number;
  readyMinor: number;
  assignedMinor: number;
}

export function factsFrom(view: MonthView, accountCount: number): Facts {
  const cats = view.groups.flatMap((g) => g.categories);
  return {
    groups: view.groups.length,
    categories: cats.length,
    accounts: accountCount,
    readyMinor: view.readyToAssignMinor,
    assignedMinor: cats.reduce((sum, c) => sum + c.allocatedMinor, 0),
  };
}

export const hasMoney = (f: Facts) => f.readyMinor > 0 || f.assignedMinor > 0;

export function isStepDone(id: StepId, f: Facts): boolean {
  switch (id) {
    case 'groups':
      return f.groups > 0;
    case 'categories':
      return f.categories > 0;
    case 'accounts':
      return f.accounts > 0;
    case 'money':
      return hasMoney(f);
    case 'assign':
      return f.categories > 0 && hasMoney(f) && f.readyMinor === 0;
    default:
      return false;
  }
}

/** Where the guide opens: the idea for a blank budget, else the first unfinished step, else the finish. */
export function openingStep(f: Facts): StepId {
  const working = STEPS.filter((s) => s.id !== 'welcome' && s.id !== 'done');
  if (!working.some((s) => isStepDone(s.id, f))) return 'welcome';
  return working.find((s) => !isStepDone(s.id, f))?.id ?? 'done';
}

export type AssignTone = 'empty' | 'todo' | 'done' | 'over';

/** `todo`: money still needs a job. `done`: every dollar assigned. `over`: assigned more than exists. */
export function assignTone(readyMinor: number, money: boolean): AssignTone {
  if (!money) return 'empty';
  if (readyMinor > 0) return 'todo';
  return readyMinor < 0 ? 'over' : 'done';
}

/** Ready to Assign while typing: the saved value, adjusted by every unsaved change. Null drafts are ignored. */
export function previewReadyToAssign(
  readyMinor: number,
  rows: { savedMinor: number; draftMinor: number | null }[],
): number {
  return rows.reduce(
    (rta, r) => (r.draftMinor === null ? rta : rta - (r.draftMinor - r.savedMinor)),
    readyMinor,
  );
}

export function accountNameProblem(raw: string, existing: string[]): string | null {
  const name = raw.trim();
  if (!name) return 'Enter an account name.';
  if (name.length > 60) return 'Keep it under 60 characters.';
  if (existing.some((other) => other.trim().toLowerCase() === name.toLowerCase())) {
    return 'You already have an account with that name.';
  }
  return null;
}
