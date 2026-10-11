import { useEffect, useState } from 'react';
import { MonthView as MonthViewType, api, errorMessage } from '../../lib/api';
import { currentMonth, formatMoney } from '../../lib/format';
import { incomeMinor } from '../../lib/transactions';
import { MonthSwitcher } from '../month/MonthPicker';
import { Loading } from '../../lib/Loading';

/** Income, spending and spending by category for one month, from existing month and transaction data. */
export function ReportsView({ budgetId, currency }: { budgetId: string; currency: string }) {
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<MonthViewType | null>(null);
  const [income, setIncome] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setView(null);
    let current = true;
    Promise.all([api.getMonth(budgetId, month), api.listTransactions(budgetId, { month })])
      .then(([m, t]) => {
        if (!current) return;
        setView(m);
        setIncome(incomeMinor(t.transactions));
        setError(null);
      })
      .catch((err) => current && setError(errorMessage(err)));
    return () => {
      current = false;
    };
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
      {error && <div className="error" role="alert">{error}</div>}
      <div className="month-header">
        <MonthSwitcher month={month} onChange={setMonth} />
      </div>

      {view === null ? (
        error ? null : <Loading label="Loading report" />
      ) : (
        <>
          <dl className="report-cards">
            <div className="report-card"><dt className="muted">Income</dt><dd><strong className="num">{formatMoney(income, currency)}</strong></dd></div>
            <div className="report-card"><dt className="muted">Spending</dt><dd><strong className="num">{formatMoney(spending, currency)}</strong></dd></div>
            <div className="report-card"><dt className="muted">Net</dt><dd><strong className={net < 0 ? 'num negative' : 'num positive'}>{formatMoney(net, currency)}</strong></dd></div>
          </dl>

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
                  {-c.activityMinor > c.allocatedMinor && <span className="visually-hidden">Over the assigned amount. </span>}
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
