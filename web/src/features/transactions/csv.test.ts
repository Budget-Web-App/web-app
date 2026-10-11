import { describe, expect, it } from 'vitest';
import { mapRows, normalizeDate, parseAmount, parseCsv } from './csv';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, CRLF, BOM and blank lines', () => {
    const text = '\uFEFFdate,payee,amount\r\n2026-10-04,"Cafe, ""Corner""",-6.50\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ['date', 'payee', 'amount'],
      ['2026-10-04', 'Cafe, "Corner"', '-6.50'],
    ]);
  });

  it('keeps a quoted newline inside one cell', () => {
    expect(parseCsv('a,b\n"x\ny",2')[1]).toEqual(['x\ny', '2']);
  });
});

describe('parseAmount', () => {
  it.each([
    ['-6.50', -650],
    ['$1,234.5', 123450],
    ['(12.30)', -1230],
    ['+10', 1000],
    ['.99', 99],
    ['0.29', 29],
  ])('reads %s as %i cents', (input, cents) => {
    expect(parseAmount(input)).toBe(cents);
  });

  it('rejects text, empty values and sub-cent precision', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('1.005')).toBeNull();
    expect(parseAmount('1e3')).toBeNull();
  });
});

describe('normalizeDate', () => {
  it('accepts ISO and US formats', () => {
    expect(normalizeDate('2026-3-4')).toBe('2026-03-04');
    expect(normalizeDate('3/4/26')).toBe('2026-03-04');
  });
  it('rejects dates that do not exist', () => {
    expect(normalizeDate('2026-02-31')).toBeNull();
    expect(normalizeDate('13/01/2026')).toBeNull();
  });
});

describe('mapRows', () => {
  it('maps columns by header and reports unreadable rows', () => {
    const { rows, errors } = mapRows(
      parseCsv('Date,Description,Amount,Note\n2026-10-04,Cafe,-6.50,latte\n2026-10-05,,-1\nbad,Shop,2'),
    );
    expect(rows).toEqual([{ date: '2026-10-04', payee: 'Cafe', amountMinor: -650, memo: 'latte' }]);
    expect(errors).toHaveLength(2);
  });

  it('explains a missing header', () => {
    expect(mapRows([['a', 'b'], ['1', '2']]).errors[0]).toMatch(/Header row/);
  });
});
