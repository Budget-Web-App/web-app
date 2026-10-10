import { useEffect, useState } from 'react';
import { MonthView as MonthViewType, api, errorMessage } from './api';
import { currentMonth, formatMoney, shiftMonth } from './format';
import { MonthPicker } from './MonthPicker';

/** Income, spending and spending by category for one month, from existing month and transaction data. */
export function ReportsView({ budgetId, currency }: { budgetId: string; currency: string }) {
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<MonthViewType | null>(null);
  const [income, setIncome] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setView(null);
    Promise.all([api.getMonth(budgetId, month), api.listTransactions(budgetId, { month })])
      .then(([m, t]) => {
        setView(m);
        setIncome(
          t.transactions
            .filter((x) => x.categoryId === null && x.amountMinor > 0 && x.transferTransactionId === null)
            .reduce((s, x) => s + x.amountMinor, 0),
        );
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [budgetId, month]);

  const rows = (view?.groups ?? [])
    .flatMap((g) => g.categories.map((c) => ({ ...c, group: g.name })))
    .filter((c) => c.activityMinor < 0)
    .sort((a, b) => a.activityMinor - b.activityMinor);
  const spending = rows.reduce((s, c) => s - c.activityMinor, 0);
  const max = rows.length ? -rows[0].activityMinor : 1;
  const net = income - spending;

  return (
    <section>
      {error && <div className="error">{error}</div>}
      <div className="month-header">
        <div className="month-switcher">
          <button className="btn btn-ghost btn-icon" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
          <MonthPicker month={month} onChange={setMonth} />
          <button className="btn btn-ghost btn-icon" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">›</button>
        </div>
      </div>

      {view === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="report-cards">
            <div className="report-card"><span className="muted">Income</span><strong className="num">{formatMoney(income, currency)}</strong></div>
            <div className="report-card"><span className="muted">Spending</span><strong className="num">{formatMoney(spending, currency)}</strong></div>
            <div className="report-card"><span className="muted">Net</span><strong className={net < 0 ? 'num negative' : 'num positive'}>{formatMoney(net, currency)}</strong></div>
          </div>

          <h2 className="section-title">Spending by category</h2>
          {rows.length === 0 ? (
            <p className="muted">No spending recorded this month.</p>
          ) : (
            <ul className="report-bars">
              {rows.map((c) => (
                <li key={c.id}>
                  <div className="report-bar-head">
                    <span><strong>{c.name}</strong> <span className="muted">{c.group}</span></span>
                    <span className="num">{formatMoney(-c.activityMinor, currency)}</span>
                  </div>
                  <div className="bar" aria-hidden="true">
                    <span className={-c.activityMinor > c.allocatedMinor ? 'over' : ''} style={{ width: `${Math.round((-c.activityMinor / max) * 100)}%` }} />
                  </div>
                  <div className="muted small">
                    {Math.round((-c.activityMinor / spending) * 100)}% of spending · {formatMoney(c.allocatedMinor, currency)} assigned
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
