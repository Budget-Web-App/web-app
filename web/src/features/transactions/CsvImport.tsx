import { useMemo, useState } from 'react';
import { Account, Transaction, api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { mapRows, parseCsv } from './csv';

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
  const { fresh, dupes } = useMemo(() => {
    const key = (r: { date: string; payee: string; amountMinor: number }) =>
      `${r.date}|${r.payee.toLowerCase()}|${r.amountMinor}`;
    const seen = new Set(existing.map(key));
    const fresh = rows.filter((r) => !seen.has(key(r)));
    return { fresh, dupes: rows.length - fresh.length };
  }, [rows, existing]);
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
        <div className="csv-preview" aria-live="polite">
          <p>
            <strong>{fresh.length}</strong> ready to import
            {dupes > 0 && `, ${dupes} look like duplicates and will be skipped`}
            {errors.length > 0 && `, ${errors.length} unreadable`}.
          </p>
          {fresh.length > 0 && (
            <div className="table-wrap">
            <table className="budget-grid">
              <caption className="visually-hidden">Preview of the first rows to import</caption>
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
            </div>
          )}
          {errors.slice(0, 2).map((e) => (
            <p key={e} className="row-error">{e}</p>
          ))}
          <button className="btn btn-primary btn-sm" onClick={run} disabled={busy || fresh.length === 0 || !accountIdUsed}>
            {busy ? 'Importing…' : `Import ${fresh.length} transaction${fresh.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
      {message && <p className="muted" role="status">{message}</p>}
    </details>
  );
}
