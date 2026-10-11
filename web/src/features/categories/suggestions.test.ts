import { describe, expect, it } from 'vitest';
import { parseMoney } from '../../lib/format';
import { suggestCategoryNames } from './suggestions';

describe('parseMoney', () => {
  it('reads plain, symbol, and grouped amounts as minor units', () => {
    expect(parseMoney('250')).toBe(25000);
    expect(parseMoney('$1,200.5')).toBe(120050);
    expect(parseMoney('0.07')).toBe(7);
  });

  it('treats an empty field as zero and rejects anything else', () => {
    expect(parseMoney('  ')).toBe(0);
    expect(parseMoney('-5')).toBeNull();
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
  });
});

describe('suggestCategoryNames', () => {
  it('skips names already in the budget and narrows as you type', () => {
    expect(suggestCategoryNames('', ['Rent/mortgage', ' utilities '])[0]).toBe('Phone');
    expect(suggestCategoryNames('gro', [])).toEqual(['Groceries']);
    expect(suggestCategoryNames('groceries', [])).toEqual([]);
  });
});
