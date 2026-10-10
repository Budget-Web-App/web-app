import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Account, MonthView as MonthViewType, api, errorMessage } from './api';
import { currentMonth, formatMoney } from './format';
import { setupComplete } from './setup';
import { starterAccounts } from './starters';

function isoToday(month: string): string {
  if (month !== currentMonth()) return `${month}-01`;
  const d = new Date();
  return `${month}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Action-first first-budget tutorial, following the tour playbook: one real
 * action per section, short explanations, visible progress, and the ability to
 * skip any section or the whole tour. Replaces the old inline checklist.
 */
export function GuidedSetup({
  budgetId,
  month,
  currency,
  view,
  busy,
  open,
  onStarter,
  onChanged,
  onClose,
}: {
  budgetId: string;
  month: string;
  currency: string;
  view: MonthViewType;
  busy: boolean;
  open: boolean;
  onStarter: () => void;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [amount, setAmount] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    api.listAccounts(budgetId).then((r) => setAccounts(r.accounts)).catch(() => undefined);
  }, [budgetId]);

  useEffect(() => {
    if (!open) return;
    skipRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const assigned = view.groups.reduce(
    (sum, group) => sum + group.categories.reduce((total, c) => total + c.allocatedMinor, 0),
    0,
  );
  const hasAccounts = accounts.length > 0;
  const hasCategories = view.groups.some((group) => group.categories.length > 0);
  const hasIncome = view.readyToAssignMinor > 0 || assigned > 0;
  const rta = view.readyToAssignMinor;
  const categoryCount = view.groups.reduce((sum, group) => sum + group.categories.length, 0);
  const allSet = setupComplete(view);
  const ready = [hasAccounts, hasCategories, hasIncome, allSet];
  const account = accounts.find((a) => a.type !== 'credit') ?? accounts[0];
  const cents = Math.round(Number(amount) * 100);

  const addStarterAccounts = async () => {
    if (pending) return;
    setPending(true);
    try {
      for (const starter of starterAccounts) {
        await api.createAccount(budgetId, starter.name, starter.type);
      }
      const { accounts: next } = await api.listAccounts(budgetId);
      setAccounts(next);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  };

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

  const sections: { label: string; title: string; body: ReactNode }[] = [
    {
      label: 'Accounts',
      title: 'Add accounts',
      body: hasAccounts ? (
        <p className="tutorial-done">
          ✓ {accounts.length} account{accounts.length === 1 ? '' : 's'} ready.
        </p>
      ) : (
        <>
          <p>Your money lives in accounts — checking, savings, and any credit cards. Start here.</p>
          <div className="tutorial-action">
            <button className="btn btn-primary btn-block" onClick={addStarterAccounts} disabled={pending}>
              {pending ? 'Adding…' : 'Add starter accounts'}
            </button>
          </div>
        </>
      ),
    },
    {
      label: 'Categories',
      title: 'Add categories',
      body: hasCategories ? (
        <p className="tutorial-done">
          ✓ {categoryCount} categories ready — rename or add your own any time.
        </p>
      ) : (
        <>
          <p>Categories are the jobs your money can do, like Rent or Groceries. Start with the essentials.</p>
          <div className="tutorial-action">
            <button className="btn btn-primary btn-block" onClick={onStarter} disabled={busy}>
              {busy ? 'Adding…' : 'Add starter categories'}
            </button>
          </div>
        </>
      ),
    },
    {
      label: 'Income',
      title: 'Add income',
      body: !hasAccounts ? (
        <p>Accounts come first — go back and add a starter set, then record income here.</p>
      ) : hasIncome ? (
        <p className="tutorial-done">
          ✓ Income recorded. {formatMoney(rta, currency)} waiting for a job.
        </p>
      ) : (
        <>
          <p>Paychecks land here as money to assign. Record one now.</p>
          <form className="guide-form" onSubmit={addIncome}>
            <input
              className="input amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Paycheck amount"
            />
            <button className="btn btn-primary" disabled={!(cents > 0)}>
              Add to {account.name}
            </button>
          </form>
        </>
      ),
    },
    {
      label: 'Assign',
      title: 'Give every dollar a job',
      body: (
        <>
          {allSet ? (
            <p className="tutorial-done">🎉 Done — every dollar has a job.</p>
          ) : (
            <p>
              Set each category's Assigned amount in the budget until Ready to assign reaches{' '}
              {formatMoney(0, currency)}.
            </p>
          )}
          <div className="tutorial-summary">
            <span>
              <strong>{accounts.length}</strong> account{accounts.length === 1 ? '' : 's'}
            </span>
            <span>
              <strong>{categoryCount}</strong> categories
            </span>
            <span>
              <strong>{formatMoney(rta, currency)}</strong> ready to assign
            </span>
          </div>
        </>
      ),
    },
  ];

  // On each open, resume at the first unfinished section — or the finish line when all done.
  useEffect(() => {
    if (open && !wasOpen.current) {
      const firstUnfinished = ready.findIndex((done) => !done);
      setStep(firstUnfinished === -1 ? sections.length - 1 : firstUnfinished);
    }
    wasOpen.current = open;
  }, [open, accounts, view]);

  if (!open) return null;
  const last = sections.length - 1;
  const doneCount = ready.filter(Boolean).length;
  const next = () => (step === last ? onClose() : setStep(step + 1));

  return (
    <div className="modal-backdrop tutorial-backdrop" onClick={onClose}>
      <div
        className="modal tutorial"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tutorial-head">
          <h2 id="tutorial-title">Set up your first budget</h2>
          <p className="tutorial-sub">
            A step-by-step setup. Do each action here, or skip ahead at your own pace.
          </p>
        </div>

        <div className="tutorial-progress">
          <div className="tutorial-track">
            {sections.map((section, i) => (
              <button
                key={section.label}
                type="button"
                className={`tutorial-seg${ready[i] ? ' done' : ''}${i === step ? ' current' : ''}`}
                aria-label={`Section ${i + 1}: ${section.label}`}
                aria-current={i === step ? 'step' : undefined}
                onClick={() => setStep(i)}
              >
                {ready[i] ? '✓ ' : ''}
                {section.label}
              </button>
            ))}
          </div>
          <span className="muted small">
            {doneCount} of {last + 1} done
          </span>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="tutorial-body">
          <h3>{sections[step].title}</h3>
          {sections[step].body}
        </div>

        <div className="tutorial-actions">
          <button className="btn-link" ref={skipRef} onClick={onClose}>
            Skip tutorial
          </button>
          <div className="tutorial-nav">
            {step > 0 && (
              <button className="btn" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            {step < last && (
              <button className="btn btn-ghost" onClick={() => setStep(step + 1)}>
                Skip step
              </button>
            )}
            <button className="btn btn-primary" onClick={next}>
              {step === last ? (allSet ? 'Done' : 'Start assigning') : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}