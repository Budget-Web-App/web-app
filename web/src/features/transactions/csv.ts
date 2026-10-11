export interface ParsedRow {
  date: string;
  payee: string;
  amountMinor: number;
  memo?: string;
}

/** Minimal RFC 4180 parser: quoted cells, escaped quotes, CRLF or LF, blank lines skipped. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const endRow = () => {
    row.push(cell.trim());
    if (row.some((c) => c !== '')) rows.push(row);
    row = [];
    cell = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else cell += ch;
  }
  endRow();
  return rows;
}

/** Accepts YYYY-MM-DD and M/D/YY(YY). Rejects dates that do not exist, such as 2026-02-31. */
export function normalizeDate(value: string): string | null {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  let y: number, m: number, d: number;
  if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  else if (us) [m, d, y] = [+us[1], +us[2], us[3].length === 2 ? 2000 + +us[3] : +us[3]];
  else return null;
  const probe = new Date(y, m - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Parses a bank amount into integer cents without floating-point math.
 * Handles "$1,234.50", "-6.5", "+10" and accounting negatives like "(12.30)".
 */
export function parseAmount(value: string): number | null {
  const stripped = value.replace(/[$,\s]/g, '');
  const negativeParens = /^\(.*\)$/.test(stripped);
  const match = /^([+-])?(\d+)?(?:\.(\d{1,2}))?$/.exec(stripped.replace(/[()]/g, ''));
  if (!match || (match[2] === undefined && match[3] === undefined)) return null;
  const minor = Number(match[2] ?? '0') * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return negativeParens || match[1] === '-' ? -minor : minor;
}

export function mapRows(table: string[][]): { rows: ParsedRow[]; errors: string[] } {
  if (table.length < 2) return { rows: [], errors: [] };
  const head = table[0].map((h) => h.toLowerCase());
  const find = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const di = find('date');
  const pi = find('payee', 'description', 'merchant', 'name');
  const ai = find('amount');
  const mi = find('memo', 'note');
  if (di < 0 || pi < 0 || ai < 0) {
    return { rows: [], errors: ['Header row needs date, payee (or description), and amount columns.'] };
  }
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((cells, i) => {
    const date = normalizeDate(cells[di] ?? '');
    const amountMinor = parseAmount(cells[ai] ?? '');
    const payee = (cells[pi] ?? '').trim();
    if (!date || amountMinor === null || amountMinor === 0 || !payee) {
      errors.push(`Row ${i + 2}: could not read date, payee, or amount.`);
      return;
    }
    rows.push({ date, payee, amountMinor, memo: mi >= 0 && cells[mi] ? cells[mi] : undefined });
  });
  return { rows, errors };
}
