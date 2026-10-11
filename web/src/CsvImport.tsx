import { useMemo, useState } from 'react';
import { Account, Transaction, api } from './api';
import { formatMoney } from './format';

export interface ParsedRow {
  date: string;
  payee: string;
  amountMinor: number;
  memo?: string;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = []; cell = '';
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

function normDate(v: string): string | null {
  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  let y: number, m: number, d: number;
  if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  else if (us) [m, d, y] = [+us[1], +us[2], us[3].length === 2 ? 2000 + +us[3] : +us[3]];
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function normAmount(v: string): number | null {
  let s = v.replace(/[$,\s]/g, '');
  const negative = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '');
  if (s === '' || !Number.isFinite(Number(s))) return null;
  const cents = Math.round(Number(s) * 100);
  return negative ? -Math.abs(cents) : cents;
}

export function mapRows(table: string[][]): { rows: ParsedRow[]; errors: string[] } {
  if (table.length < 2) return { rows: [], errors: [] };
  const head = table[0].map((h) => h.toLowerCase());
  const find = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const di = find('date'), pi = find('payee', 'description', 'merchant', 'name'), ai = find('amount'), mi = find('memo', 'note');
  if (di < 0 || pi < 0 || ai < 0) {
    return { rows: [], errors: ['Header row needs date, payee (or description), and amount columns.'] };
  }
  const rows: ParsedRow[] = [];
  const errors: string[] = [];
  table.slice(1).forEach((cells, i) => {
    const date = normDate(cells[di] ?? '');
    const amountMinor = normAmount(cells[ai] ?? '');
    const payee = (cells[pi] ?? '').trim();
    if (!date || amountMinor === null || amountMinor === 0 || !payee) {
      errors.push(`Row ${i + 2}: could not read date, payee, or amount.`);
      return;
    }
    rows.push({ date, payee, amountMinor, memo: mi >= 0 && cells[mi] ? cells[mi] : undefined });
  });
  return { rows, errors };
}

export function CsvImport({
  budgetId,
  currency,
  accounts,
  accountId,
  existing,
  onDone,
}: {
  budgetId: string;
  currency: string;
  accounts: Account[];
  accountId: string;
  existing: Transaction[];
  onDone: () => void;
}) {
  const [text, setText] = useState('');
  const [target, setTarget] = useState(accountId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { rows, errors } = useMemo(() => mapRows(parseCsv(text)), [text]);
  const key = (r: { date: string; payee: string; amountMinor: number }) => `${r.date}|${r.payee.toLowerCase()}|${r.amountMinor}`;
  const seen = new Set(existing.map(key));
  const fresh = rows.filter((r) => !seen.has(key(r)));
  const dupes = rows.length - fresh.length;
  const accountIdUsed = target || accountId;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ''));
    reader.readAsText(file);
  };

  const run = async () => {
    setBusy(true);
    let ok = 0;
    let failed = 0;
    for (const r of fresh) {
      try {
        await api.createTransaction(budgetId, {
          accountId: accountIdUsed,
          payee: r.payee,
          amountMinor: r.amountMinor,
          date: r.date,
          ...(r.memo ? { memo: r.memo } : {}),
        });
        ok++;
      } catch {
        failed++;
      }
    }
    setBusy(false);
    setText('');
    setMessage(`Imported ${ok} transaction${ok === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}. Rows in other months appear when you switch month.`);
    onDone();
  };

  return (
    <details className="csv-import">
      <summary>Import from CSV</summary>
      <p className="muted">
        Paste rows or choose a file. Needs a header with date, payee (or description), and
        amount; negative amounts are spending. Imported rows are uncategorized so you can
        review them.
      </p>
      <div className="csv-controls">
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} aria-label="CSV file" />
        <select className="select" value={accountIdUsed} onChange={(e) => setTarget(e.target.value)} aria-label="Import into account">
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <textarea
        className="input csv-text"
        rows={4}
        placeholder={'date,payee,amount\n2026-10-04,Corner Cafe,-6.50'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="CSV text"
      />
      {text.trim() !== '' && (
        <div className="csv-preview">
          <p>
            <strong>{fresh.length}</strong> ready to import
            {dupes > 0 && `, ${dupes} look like duplicates and will be skipped`}
            {errors.length > 0 && `, ${errors.length} unreadable`}.
          </p>
          {fresh.length > 0 && (
            <table className="budget-grid">
              <tbody>
                {fresh.slice(0, 4).map((r, i) => (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.payee}</td>
                    <td className="right num">{formatMoney(r.amountMinor, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {errors.slice(0, 2).map((e) => (
            <p key={e} className="row-error">{e}</p>
          ))}
          <button className="btn btn-primary btn-sm" onClick={run} disabled={busy || fresh.length === 0 || !accountIdUsed}>
            {busy ? 'Importing…' : `Import ${fresh.length} transaction${fresh.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
      {message && <p className="muted">{message}</p>}
    </details>
  );
}
