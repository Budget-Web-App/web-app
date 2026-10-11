import { describe, expect, it } from 'vitest';
import { MonthView } from '../../lib/api';
import { setupComplete } from './setup';

const view = (readyToAssignMinor: number, allocated: number[]): MonthView => ({
  month: '2026-10',
  readyToAssignMinor,
  groups: allocated.length
    ? [
        {
          id: 'grp_1',
          name: 'Everyday',
          categories: allocated.map((minor, i) => ({
            id: `catg_${i}`,
            name: `Category ${i}`,
            allocatedMinor: minor,
            activityMinor: 0,
            availableMinor: minor,
          })),
        },
      ]
    : [],
});

describe('setupComplete', () => {
  it('is false with no categories', () => {
    expect(setupComplete(view(0, []))).toBe(false);
  });

  it('is false while income is still unassigned', () => {
    expect(setupComplete(view(5000, [1000]))).toBe(false);
  });

  it('is false when no income has been recorded', () => {
    expect(setupComplete(view(0, [0]))).toBe(false);
  });

  it('is true when categories exist and every dollar is assigned', () => {
    expect(setupComplete(view(0, [1000, 2000]))).toBe(true);
  });
});
