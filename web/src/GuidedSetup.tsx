import { FormEvent, useEffect, useState } from 'react';
import { Account, MonthView as MonthViewType, api, errorMessage } from './api';
import { currentMonth, formatMoney } from './format';
import { navigate } from './router';

function isoToday(month: string): string {
  if (month !== currentMonth()) return `${month}-01`;
  const d = new Date();
  return `${month}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Three-step first-budget walkthrough: categories, income, then assign every dollar. */
export function GuidedSetup({
  budgetId,
  month,
  currency,
  view,
  canEdit,
  busy,
  onStarter,
  onChanged,
}: {
  budgetId: string;
  month: string;
  currency: string;
  view: MonthViewType;
  canEdit: boolean;
  busy: boolean;
  onStarter: () => void;
  onChanged: () => void;
}) {
  const dismissKey = `onebudget:guide-dismissed:${budgetId}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(dismissKey) === '1');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listAccounts(budgetId).then((r) => setAccounts(r.accounts)).catch(() => undefined);
  }, [budgetId]);

  const assigned = view.groups.reduce(
    (s, g) => s + g.categories.reduce((t, c) => t + c.allocatedMinor, 0),
    0,
  );
  const hasCats = view.groups.some((g) => g.categories.length > 0);
  const hasIncome = view.readyToAssignMinor > 0 || assigned > 0;
  const rta = view.readyToAssignMinor;
  const done = hasCats && hasIncome && rta === 0;
  if (dismissed || done || !canEdit) return null;

  const active = !hasCats ? 1 : !hasIncome ? 2 : 3;
  const cents = Math.round(Number(amount) * 100);
  const account = accounts.find((a) => a.type !== 'credit') ?? accounts[0];

  const addIncome = async (e: FormEvent) => {
    e.preventDefault();
    if (!account || !(cents > 0)) return;
    try {
      await api.createTransaction(budgetId, {
        accountId: account.id,
        payee: 'Paycheck',
        amountMinor: cents,
        date: isoToday(month),
      });
      setAmount('');
      setError(null);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const dismiss = () => {
    localStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  const step = (n: number, title: string, complete: boolean, body: React.ReactNode) => (
    <li className={`guide-step${complete ? ' complete' : ''}${active === n ? ' active' : ''}`}>
      <span className="guide-num" aria-hidden="true">{complete ? '✓' : n}</span>
      <div className="guide-body">
        <strong>{title}</strong>
        {active === n && <div className="guide-detail">{body}</div>}
      </div>
    </li>
  );

  return (
    <aside className="guide" aria-label="First budget walkthrough">
      <div className="guide-head">
        <div>
          <h3>Set up your first budget</h3>
          <p className="muted">Give every dollar a job in three quick steps.</p>
        </div>
        <button className="btn-link" onClick={dismiss}>Hide</button>
      </div>
      {error && <div className="error">{error}</div>}
      <ol className="guide-steps">
        {step(1, 'Pick your categories', hasCats, (
          <>
            <p>Categories are the jobs your money can do, like Rent or Groceries.</p>
            <button className="btn btn-primary btn-sm" onClick={onStarter} disabled={busy}>
              {busy ? 'Adding…' : 'Add starter categories'}
            </button>
          </>
        ))}
        {step(2, 'Add your paycheck', hasIncome, account ? (
          <form className="guide-form" onSubmit={addIncome}>
            <input
              className="input amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Paycheck amount"
            />
            <button className="btn btn-primary btn-sm" disabled={!(cents > 0)}>
              Add to {account.name}
            </button>
          </form>
        ) : (
          <>
            <p>You need an account to hold your money first.</p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/budgets/${budgetId}/accounts`)}
            >
              Add an account
            </button>
          </>
        ))}
        {step(3, 'Assign every dollar', done, (
          <p>
            Type amounts in the <strong>Assigned</strong> column until Ready to assign
            reaches <strong>{formatMoney(0, currency)}</strong>. You have{' '}
            <strong>{formatMoney(rta, currency)}</strong> left to give a job.
          </p>
        ))}
      </ol>
    </aside>
  );
}
