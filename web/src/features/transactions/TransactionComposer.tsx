import { FormEvent, useRef, useState } from 'react';
import { Account, CategoryGroup, Transaction, TransactionInput, errorMessage } from '../../lib/api';
import { formatMoney, parseMoney } from '../../lib/format';
import { todayIso } from '../accounts/shared';
import { CategoryOptions } from './CategoryOptions';

type Kind = 'expense' | 'income' | 'transfer';
const KINDS: { id: Kind; label: string }[] = [
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Transfer' },
];

/**
 * Opens only when the person wants to add something. Enter saves and keeps the
 * panel open for the next one; Escape closes it. Memo and account stay out of
 * the way until they matter.
 */
export function TransactionComposer({
  accounts,
  groups,
  fixedAccountId,
  currency,
  known,
  onAdd,
  onClose,
}: {
  accounts: Account[];
  groups: CategoryGroup[];
  /** Set when viewing one account; otherwise the person picks. */
  fixedAccountId: string | null;
  currency: string;
  known: Transaction[];
  onAdd: (input: TransactionInput) => Promise<void>;
  onClose: () => void;
}) {
  const open = accounts.filter((a) => !a.closed);
  const [kind, setKind] = useState<Kind>('expense');
  const [accountId, setAccountId] = useState(fixedAccountId ?? open[0]?.id ?? '');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [date, setDate] = useState(todayIso());
  const [memo, setMemo] = useState('');
  const [showMemo, setShowMemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const payeeRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const cents = parseMoney(amount) ?? 0;
  const targets = open.filter((a) => a.id !== accountId);
  const valid =
    accountId !== '' &&
    cents > 0 &&
    date !== '' &&
    (kind === 'transfer' ? transferTo !== '' : payee.trim() !== '');

  const pickPayee = (name: string) => {
    setPayee(name);
    const match = known.find(
      (t) => t.payee.toLowerCase() === name.trim().toLowerCase() && !t.transferTransactionId,
    );
    if (match && categoryId === '' && amount === '') {
      setCategoryId(match.categoryId ?? '');
      setKind(match.amountMinor > 0 ? 'income' : 'expense');
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    const targetName = accounts.find((a) => a.id === transferTo)?.name ?? '';
    const input: TransactionInput = {
      accountId,
      payee: kind === 'transfer' ? `Transfer to ${targetName}` : payee.trim(),
      amountMinor: kind === 'income' ? cents : -cents,
      date,
    };
    if (memo.trim()) input.memo = memo.trim();
    if (kind === 'transfer') input.transferAccountId = transferTo;
    else if (categoryId) input.categoryId = categoryId;
    setBusy(true);
    try {
      await onAdd(input);
      setAdded(`Added ${input.payee}, ${formatMoney(input.amountMinor, currency)}`);
      setPayee('');
      setAmount('');
      setMemo('');
      setError(null);
      (kind === 'transfer' ? amountRef : payeeRef).current?.focus();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="composer"
      onSubmit={submit}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      aria-label="Add transaction"
    >
      <div className="composer-top">
        <div className="seg" role="radiogroup" aria-label="Transaction type">
          {KINDS.map((k) => (
            <label key={k.id} className={`seg-item${kind === k.id ? ' on' : ''}`}>
              <input
                type="radio"
                name="txn-kind"
                className="visually-hidden"
                checked={kind === k.id}
                onChange={() => setKind(k.id)}
              />
              {k.label}
            </label>
          ))}
        </div>
        {fixedAccountId === null && (
          <select
            className="select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            aria-label="Account"
          >
            {open.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn-link composer-close" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="composer-fields">
        {kind === 'transfer' ? (
          <select
            className="select grow"
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            aria-label="Transfer to account"
            autoFocus
          >
            <option value="">Transfer to…</option>
            {targets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              ref={payeeRef}
              className="input grow"
              placeholder="Payee"
              list="payee-options"
              autoComplete="off"
              autoFocus
              value={payee}
              onChange={(e) => pickPayee(e.target.value)}
              aria-label="Payee"
            />
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-label="Category"
            >
              <CategoryOptions
                groups={groups}
                placeholder={kind === 'income' ? 'Ready to assign' : 'Choose later'}
              />
            </select>
          </>
        )}
        <input
          ref={amountRef}
          className="input composer-amount"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Amount in dollars"
        />
        <datalist id="payee-options">
          {Array.from(new Set(known.map((t) => t.payee))).map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </div>

      <div className="composer-bottom">
        <input
          type="date"
          className="input composer-date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
        />
        {showMemo ? (
          <input
            className="input grow"
            placeholder="Memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            aria-label="Memo"
            autoFocus
          />
        ) : (
          <button type="button" className="btn-link" onClick={() => setShowMemo(true)}>
            + Add memo
          </button>
        )}
        <span className="grow" />
        <button className="btn btn-primary" disabled={!valid || busy}>
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>

      <p className={`composer-note small ${error ? 'negative' : 'muted'}`} role="status">
        {error ?? added ?? 'Enter adds and keeps this open. Esc closes.'}
      </p>
    </form>
  );
}
