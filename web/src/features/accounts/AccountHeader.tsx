import { Component, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Account, Transaction, api, errorMessage } from '../../lib/api';
import { dateLabel, formatMoney } from '../../lib/format';
import { Link } from '../../app/Link';
import { Modal } from '../../lib/Modal';
import { readStored, writeStored } from '../../lib/storage';
import { PlusIcon } from '../categories/NameComposer';
import { TYPE_LABEL, parseBalance, reconciledKey, signedBalance, todayIso } from './shared';

/** Keeps a header failure from taking the whole register down: shows a plain title and logs the cause. */
export class HeaderBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('AccountHeader failed:', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Account page header: identity, reconcile status, and cleared + uncleared = working balance. */
export function AccountHeader({
  budgetId,
  currency,
  account,
  canEdit,
  version,
  onAddTransaction,
  onChanged,
}: {
  budgetId: string;
  currency: string;
  account: Account;
  canEdit: boolean;
  /** Bumps whenever the register reloads, so balances stay current. */
  version: number;
  onAddTransaction: () => void;
  onChanged: () => void;
}) {
  const [all, setAll] = useState<Transaction[] | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [stamp, setStamp] = useState<string | null>(() =>
    readStored(reconciledKey(budgetId, account.id)),
  );

  useEffect(() => {
    setStamp(readStored(reconciledKey(budgetId, account.id)));
  }, [budgetId, account.id]);

  useEffect(() => {
    let current = true;
    api
      .listTransactions(budgetId, { accountId: account.id })
      .then(({ transactions }) => current && setAll(Array.isArray(transactions) ? transactions : []))
      .catch(() => current && setAll([]));
    return () => {
      current = false;
    };
  }, [budgetId, account.id, version]);

  const { cleared, uncleared, unclearedCount } = useMemo(() => {
    let c = 0;
    let u = 0;
    let n = 0;
    for (const t of all ?? []) {
      if (t.cleared === 'cleared') c += t.amountMinor;
      else {
        u += t.amountMinor;
        n += 1;
      }
    }
    return { cleared: c, uncleared: u, unclearedCount: n };
  }, [all]);

  const tone = (minor: number) =>
    account.type !== 'credit' && minor < 0 ? 'num negative' : 'num';
  const base = `/budgets/${encodeURIComponent(budgetId)}`;

  return (
    <header className="acct-detail">
      <div className="acct-detail-top">
        <div>
          <Link className="small back-crumb" to={`${base}/accounts`}>
            ‹ Accounts
          </Link>
          <h2 className="acct-title">{account.name}</h2>
          <p className="acct-detail-meta muted">
            {TYPE_LABEL[account.type]}
            <span aria-hidden="true"> · </span>
            {stamp ? `Reconciled ${dateLabel(stamp)}` : 'Not yet reconciled'}
            {account.closed && ' · Closed'}
          </p>
        </div>
        {canEdit && !account.closed && (
          <div className="acct-actions">
            <button className="btn" onClick={onAddTransaction}>
              <PlusIcon /> Add transaction
            </button>
            <button className="btn btn-primary" onClick={() => setReconciling(true)} disabled={all === null}>
              Reconcile
            </button>
          </div>
        )}
      </div>

      <dl className="balance-strip" aria-label="Account balances">
        <div>
          <dt>Cleared balance</dt>
          <dd className={tone(cleared)}>{all ? formatMoney(cleared, currency) : '–'}</dd>
        </div>
        <span className="op" aria-hidden="true">+</span>
        <div>
          <dt>Uncleared balance</dt>
          <dd className={tone(uncleared)}>{all ? formatMoney(uncleared, currency) : '–'}</dd>
        </div>
        <span className="op" aria-hidden="true">=</span>
        <div>
          <dt>Working balance</dt>
          <dd className={tone(cleared + uncleared)}>
            {all ? formatMoney(cleared + uncleared, currency) : '–'}
          </dd>
        </div>
      </dl>

      {reconciling && (
        <ReconcileModal
          budgetId={budgetId}
          currency={currency}
          account={account}
          cleared={cleared}
          unclearedCount={unclearedCount}
          onClose={() => setReconciling(false)}
          onReconciled={(iso) => {
            writeStored(reconciledKey(budgetId, account.id), iso);
            setStamp(iso);
            onChanged();
          }}
        />
      )}
    </header>
  );
}

function ReconcileModal({
  budgetId,
  currency,
  account,
  cleared,
  unclearedCount,
  onClose,
  onReconciled,
}: {
  budgetId: string;
  currency: string;
  account: Account;
  cleared: number;
  unclearedCount: number;
  onClose: () => void;
  onReconciled: (iso: string) => void;
}) {
  const [step, setStep] = useState<'confirm' | 'differs' | 'done'>('confirm');
  const [bank, setBank] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [adjusted, setAdjusted] = useState(0);

  const isCredit = account.type === 'credit';
  const parsed = parseBalance(bank);
  const bankMinor = parsed === null ? null : signedBalance(account.type, parsed);
  const diff = bankMinor === null ? null : bankMinor - cleared;

  const finish = (adjustment = 0) => {
    setAdjusted(adjustment);
    onReconciled(new Date().toISOString());
    setStep('done');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (diff === null || saving) return;
    if (diff === 0) return finish();
    setSaving(true);
    try {
      const { transactions } = await api.createTransaction(budgetId, {
        accountId: account.id,
        payee: 'Reconciliation Balance Adjustment',
        amountMinor: diff,
        date: todayIso(),
      });
      for (const t of transactions.filter((t) => t.accountId === account.id)) {
        await api.updateTransaction(budgetId, t.id, { cleared: 'cleared' });
      }
      finish(diff);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  if (step === 'done') {
    return (
      <Modal title="Reconciled" onClose={onClose}>
        <p className="modal-body">
          {account.name} matches your bank
          {adjusted !== 0 && ` after a ${formatMoney(adjusted, currency)} adjustment`}.
        </p>
        <div className="modal-actions">
          <button className="btn btn-primary" data-autofocus onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  if (step === 'confirm') {
    return (
      <Modal title={`Reconcile ${account.name}`} onClose={onClose}>
        <p className="reconcile-q">
          {isCredit ? 'Does your bank say you owe' : 'Is your bank balance'}{' '}
          <strong className="num">
            {formatMoney(isCredit ? Math.abs(cleared) : cleared, currency)}
          </strong>
          ?
        </p>
        <p className="muted small">
          This is your cleared balance.
          {unclearedCount > 0 &&
            ` ${unclearedCount} uncleared ${unclearedCount === 1 ? 'transaction isn’t' : 'transactions aren’t'} counted. Mark any that have posted at your bank as cleared first.`}
        </p>
        <div className="modal-actions">
          <button className="btn" onClick={() => setStep('differs')}>
            No, it's different
          </button>
          <button className="btn btn-primary" data-autofocus onClick={() => finish()}>
            Yes, it matches
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="What does your bank show?" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="bank-balance">
            {isCredit ? 'Amount you owe, per your bank' : 'Current balance, per your bank'}
          </label>
          <input
            id="bank-balance"
            className={`input${bankMinor === null ? ' invalid' : ''}`}
            data-autofocus
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={bank}
            onChange={(e) => {
              setBank(e.target.value);
              setError(null);
            }}
          />
        </div>
        <p className={`small ${error ? 'negative' : 'muted'}`} role="status">
          {error ??
            (diff === null
              ? 'Enter an amount like 1,250.00.'
              : diff === 0
                ? 'That matches your cleared balance.'
                : `Your cleared balance is off by ${formatMoney(Math.abs(diff), currency)}. Check for missing transactions, or add an adjustment.`)}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={() => setStep('confirm')}>
            Back
          </button>
          <button className="btn btn-primary" disabled={diff === null || saving}>
            {saving ? 'Saving…' : diff === 0 ? 'Finish' : 'Add adjustment & finish'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
