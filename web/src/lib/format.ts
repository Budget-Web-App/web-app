const formatters = new Map<string, Intl.NumberFormat>();

/** Cache each currency's formatter: money renders in every table row, and building one is costly. */
function formatter(currency: string): Intl.NumberFormat {
  let found = formatters.get(currency);
  if (!found) {
    found = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    formatters.set(currency, found);
  }
  return found;
}

export function formatMoney(minor: number, currency = 'USD'): string {
  return formatter(currency).format(minor / 100);
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return new Date(year, monthIndex - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number);
  const shifted = new Date(year, monthIndex - 1 + delta, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Parses what a person types into an amount field ("250", "$1,200.5") into
 * integer minor units without floating-point math. An empty field is 0; text
 * that is not a plain non-negative amount returns null.
 */
export function parseMoney(raw: string): number | null {
  const text = raw.replace(/[\s$,]/g, '');
  if (text === '') return 0;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}
