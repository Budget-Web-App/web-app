import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';

describe('formatMoney', () => {
  it('formats minor units as currency', () => {
    expect(formatMoney(123456)).toBe('$1,234.56');
    expect(formatMoney(-650)).toBe('-$6.50');
  });

  it('keeps currencies apart when the formatter is reused', () => {
    expect(formatMoney(100, 'USD')).toBe('$1.00');
    expect(formatMoney(100, 'EUR')).toBe('€1.00');
    expect(formatMoney(100, 'USD')).toBe('$1.00');
  });
});
