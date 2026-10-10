import { useEffect, useState } from 'react';
import { MonthCategory, MonthView as MonthViewType, api } from './api';
import { formatMoney, shiftMonth } from './format';

export interface FundEntry {
  category: MonthCategory;
  nextMinor: number;
}

/**
 * Irregular-income helper: mark the categories you must pay every month, see
 * whether this month's income covers them, and fund them before anything else.
 */
export function MinimumMonth({
  budgetId,
  month,
  currency,
  view,
  onFund,
}: {
  budgetId: string;
  month: string;
  currency: string;
  view: MonthViewType;
  onFund: (entries: FundEntry[]) => void;
}) {
  const storeKey = `onebudget:essentials:${budgetId}`;
  const [essentials, setEssentials] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) ?? '[]');
    } catch {
      return [];
    }
  });
  const [prev, setPrev] = useState<Record<string, number>>({});
  const [income, setIncome] = useState(0);

  useEffect(() => {
    api
      .getMonth(budgetId, shiftMonth(month, -1))
      .then((p) => {
        const map: Record<string, number> = {};
        p.groups.forEach((g) => g.categories.forEach((c) => (map[c.id] = c.allocatedMinor)));
        setPrev(map);
      })
      .catch(() => setPrev({}));
  }, [budgetId, month]);

  useEffect(() => {
    api
      .listTransactions(budgetId, { month })
      .then(({ transactions }) =>
        setIncome(
          transactions
            .filter((t) => t.categoryId === null && t.amountMinor > 0 && t.transferTransactionId === null)
            .reduce((s, t) => s + t.amountMinor, 0),
        ),
      )
      .catch(() => setIncome(0));
  }, [budgetId, month, view]);

  const all = view.groups.flatMap((g) => g.categories);
  const toggle = (id: string) => {
    const next = essentials.includes(id) ? essentials.filter((e) => e !== id) : [...essentials, id];
    setEssentials(next);
    localStorage.setItem(storeKey, JSON.stringify(next));
  };

  const chosen = all.filter((c) => essentials.includes(c.id));
  // What an essential usually needs: last month's assignment, else this month's.
  const need = (c: MonthCategory) => (prev[c.id] > 0 ? prev[c.id] : c.allocatedMinor);
  const needTotal = chosen.reduce((s, c) => s + need(c), 0);
  const covered = needTotal > 0 ? Math.min(100, Math.round((income / needTotal) * 100)) : 0;

  let remaining = Math.max(view.readyToAssignMinor, 0);
  const entries: FundEntry[] = [];
  for (const c of chosen) {
    const shortfall = need(c) - c.allocatedMinor;
    if (shortfall > 0 && remaining > 0) {
      const add = Math.min(shortfall, remaining);
      remaining -= add;
      entries.push({ category: c, nextMinor: c.allocatedMinor + add });
    }
  }
  const shortfallTotal = chosen.reduce((t, c) => t + Math.max(need(c) - c.allocatedMinor, 0), 0);
  const fundTotal = entries.reduce((s, e) => s + e.nextMinor - e.category.allocatedMinor, 0);

  const summary =
    chosen.length === 0
      ? 'Minimum month'
      : `Minimum month: ${covered}% of essentials covered by income`;

  return (
    <details className="min-month">
      <summary>{summary}</summary>
      <p className="muted">
        Income that arrives unevenly? Mark the categories you must pay every month. We compare
        them with the income recorded this month and can fund them first.
      </p>
      <div className="chip-row" role="group" aria-label="Essential categories">
        {all.map((c) => (
          <button
            key={c.id}
            className={`chip${essentials.includes(c.id) ? ' on' : ''}`}
            aria-pressed={essentials.includes(c.id)}
            onClick={() => toggle(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
      {chosen.length > 0 && (
        <div className="min-stats">
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${covered}%` }} />
          </div>
          <p>
            Essentials usually need <strong>{formatMoney(needTotal, currency)}</strong>; income so
            far this month is <strong>{formatMoney(income, currency)}</strong>.{' '}
            {income >= needTotal
              ? `Essentials are covered with ${formatMoney(income - needTotal, currency)} to spare.`
              : `You need ${formatMoney(needTotal - income, currency)} more income to cover them.`}
          </p>
          <button
            className="btn btn-primary btn-sm"
            disabled={entries.length === 0}
            onClick={() => onFund(entries)}
          >
            {entries.length === 0
              ? shortfallTotal > 0
                ? `Short by ${formatMoney(shortfallTotal, currency)}: no unassigned money left`
                : 'Essentials already funded'
              : `Fund essentials first (${formatMoney(fundTotal, currency)})`}
          </button>
        </div>
      )}
    </details>
  );
}
