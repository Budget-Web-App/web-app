import { FormEvent, useEffect, useState } from 'react';
import { Account, MonthView, api } from '../../lib/api';
import { currentMonth, formatMoney, parseMoney } from '../../lib/format';
import { Link } from '../../app/Link';
import { HABITS } from './content';
import {
  AssignTone,
  Facts,
  assignTone,
  hasMoney,
  previewReadyToAssign,
} from './guide';
import { Callout, Problem, useAction } from './parts';

function isoToday(month: string): string {
  if (month !== currentMonth()) return `${month}-01`;
  const d = new Date();
  return `${month}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONEY_LABELS = ['Starting balance', 'Paycheck'];

export function MoneyStep({
  budgetId,
  month,
  currency,
  view,
  accounts,
  onChanged,
}: {
  budgetId: string;
  month: string;
  currency: string;
  view: MonthView;
  accounts: Account[];
  onChanged: () => Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState(MONEY_LABELS[0]);
  const defaultAccount = (accounts.find((a) => a.type !== 'credit') ?? accounts[0])?.id ?? '';
  const [accountId, setAccountId] = useState(defaultAccount);
  const { pending, problem, setProblem, run } = useAction();

  useEffect(() => {
    if (!accounts.some((a) => a.id === accountId)) setAccountId(defaultAccount);
  }, [accounts, accountId, defaultAccount]);

  if (accounts.length === 0) {
    return <Callout>Money lands in an account. Go back one step and add your first account.</Callout>;
  }

  const cents = parseMoney(amount) ?? 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (cents <= 0) return setProblem('Enter an amount greater than zero, such as 1500 or 1500.25.');
    const ok = await run(async () => {
      await api.createTransaction(budgetId, {
        accountId,
        payee: label,
        amountMinor: cents,
        date: isoToday(month),
      });
      await onChanged();
    });
    if (ok) setAmount('');
  };

  return (
    <>
      <form className="guide-form guide-form-wrap" onSubmit={submit} noValidate>
        <input
          className={`input amount${problem ? ' invalid' : ''}`}
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Amount"
          value={amount}
          autoComplete="off"
          onChange={(e) => {
            setAmount(e.target.value);
            setProblem(null);
          }}
        />
        <select className="select" aria-label="Into account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" disabled={pending || cents <= 0}>
          {pending ? 'Adding…' : 'Add to budget'}
        </button>
      </form>
      <div className="chip-row" role="group" aria-label="What is this money">
        {MONEY_LABELS.map((l) => (
          <button key={l} type="button" className="chip" aria-pressed={label === l} onClick={() => setLabel(l)}>
            {l}
          </button>
        ))}
      </div>
      {problem && <Problem>{problem}</Problem>}
      <p className="guide-status" role="status">
        {view.readyToAssignMinor > 0 ? (
          <>
            <strong>{formatMoney(view.readyToAssignMinor, currency)}</strong> is ready to assign. Add more
            if you have it, or continue.
          </>
        ) : (
          <>Nothing to assign yet.</>
        )}
      </p>
    </>
  );
}

const TONE_COPY: Record<AssignTone, (rta: string) => string> = {
  empty: () => 'Add money in the previous step first.',
  todo: (rta) => `${rta} left to give a job.`,
  done: () => 'Every dollar has a job.',
  over: (rta) => `Over-assigned by ${rta}. Lower an amount below.`,
};

export function AssignStep({
  budgetId,
  month,
  currency,
  view,
  facts,
  onChanged,
}: {
  budgetId: string;
  month: string;
  currency: string;
  view: MonthView;
  facts: Facts;
  onChanged: () => Promise<void>;
}) {
  const rows = view.groups.flatMap((g) => g.categories.map((c) => ({ ...c, group: g.name })));
  const toText = (minor: number) => (minor / 100).toFixed(2);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((c) => [c.id, toText(c.allocatedMinor)])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  // A category added elsewhere shows up here with its saved amount.
  useEffect(() => {
    setDrafts((d) => {
      const missing = rows.filter((c) => !(c.id in d));
      return missing.length ? { ...d, ...Object.fromEntries(missing.map((c) => [c.id, toText(c.allocatedMinor)])) } : d;
    });
  }, [view]);

  const commit = async (id: string) => {
    const row = rows.find((c) => c.id === id);
    if (!row) return;
    const next = parseMoney(drafts[id] ?? '');
    if (next === null) {
      setErrors((e) => ({ ...e, [id]: 'Enter an amount such as 250 or 250.50.' }));
      return;
    }
    setErrors((e) => ({ ...e, [id]: '' }));
    setDrafts((d) => ({ ...d, [id]: toText(next) }));
    if (next === row.allocatedMinor) return;
    try {
      await api.setAllocations(budgetId, month, [{ categoryId: id, allocatedMinor: next }]);
      await onChanged();
    } catch {
      setErrors((e) => ({ ...e, [id]: 'Could not save. Try again.' }));
    }
  };

  const money = hasMoney(facts);
  const live = previewReadyToAssign(
    view.readyToAssignMinor,
    rows.map((c) => ({ savedMinor: c.allocatedMinor, draftMinor: parseMoney(drafts[c.id] ?? '') })),
  );
  // The server value already includes saved edits, so only unsaved drafts shift the preview.
  const tone = assignTone(live, money);
  const meterClass = tone === 'over' ? 'rta negative' : tone === 'done' || tone === 'empty' ? 'rta zero' : 'rta';

  if (rows.length === 0) {
    return <Callout>You need at least one category to give money a job. Go back and add one.</Callout>;
  }

  return (
    <>
      <div className={`${meterClass} guide-meter`} role="status" aria-live="polite">
        <span className="rta-value">{formatMoney(live, currency)}</span>
        <span className="rta-label">Ready to assign</span>
        <span className="rta-cue">{TONE_COPY[tone](formatMoney(Math.abs(live), currency))}</span>
      </div>

      <div className="guide-assign">
        {view.groups
          .filter((g) => g.categories.length > 0)
          .map((g) => (
            <fieldset key={g.id}>
              <legend>{g.name}</legend>
              {g.categories.map((c) => (
                <div className="guide-assign-row" key={c.id}>
                  <label htmlFor={`assign-${c.id}`}>{c.name}</label>
                  <input
                    id={`assign-${c.id}`}
                    className={`input amount${errors[c.id] ? ' invalid' : ''}`}
                    inputMode="decimal"
                    autoComplete="off"
                    value={drafts[c.id] ?? ''}
                    aria-invalid={errors[c.id] ? true : undefined}
                    aria-describedby={errors[c.id] ? `assign-err-${c.id}` : undefined}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    onBlur={() => commit(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        commit(c.id);
                      }
                    }}
                  />
                  {errors[c.id] && <Problem id={`assign-err-${c.id}`}>{errors[c.id]}</Problem>}
                </div>
              ))}
            </fieldset>
          ))}
      </div>
    </>
  );
}

export function DoneStep({
  budgetId,
  facts,
  currency,
  onClose,
}: {
  budgetId: string;
  facts: Facts;
  currency: string;
  onClose: () => void;
}) {
  const tiles: [string, string][] = [
    [String(facts.groups), facts.groups === 1 ? 'group' : 'groups'],
    [String(facts.categories), facts.categories === 1 ? 'category' : 'categories'],
    [String(facts.accounts), facts.accounts === 1 ? 'account' : 'accounts'],
    [formatMoney(facts.readyMinor, currency), 'ready to assign'],
  ];
  return (
    <>
      <div className="guide-tiles">
        {tiles.map(([value, label]) => (
          <span key={label}>
            <strong>{value}</strong> {label}
          </span>
        ))}
      </div>
      {facts.readyMinor !== 0 && (
        <Callout>
          {facts.readyMinor > 0
            ? `${formatMoney(facts.readyMinor, currency)} still has no job. Open the Assigned column in your budget to finish.`
            : 'You assigned more than you have. Lower an Assigned amount in your budget.'}
        </Callout>
      )}
      <h4 className="guide-subhead">Four habits that make it stick</h4>
      <ol className="guide-habits">
        {HABITS.map((h) => (
          <li key={h.title}>
            <strong>{h.title}</strong>
            <span className="muted">{h.body}</span>
          </li>
        ))}
      </ol>
      <div className="guide-finish">
        <Link
          className="btn"
          to={`/budgets/${encodeURIComponent(budgetId)}/transactions`}
          onClick={onClose}
        >
          Record spending
        </Link>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Go to my budget
        </button>
      </div>
    </>
  );
}
