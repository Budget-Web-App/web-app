import { FormEvent, useEffect, useRef, useState } from 'react';
import { CsvImport } from './CsvImport';
import {
  Account,
  CategoryGroup,
  Role,
  Transaction,
  TransactionInput,
  api,
  errorMessage,
} from './api';
import { currentMonth, formatMoney, monthLabel, shiftMonth } from './format';
import { categoryOptionGroups, isHiddenOption } from './categories';
import { navigate, useRoute } from './router';

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };
type Mode = 'expense' | 'transfer';

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`;
}

function CategoryOptions({
  groups,
  placeholder = 'Ready to assign',
  selected,
}: {
  groups: CategoryGroup[];
  placeholder?: string;
  selected?: { id: string; name: string };
}) {
  const optionGroups = categoryOptionGroups(groups);
  return (
    <>
      <option value="">{placeholder}</option>
      {optionGroups.map((group) => (
        <optgroup key={group.id} label={group.name}>
          {group.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </optgroup>
      ))}
      {selected && isHiddenOption(optionGroups, selected.id) && (
        <option value={selected.id}>{selected.name}</option>
      )}
    </>
  );
}

export function TransactionsView({
  budgetId,
  currency,
  role,
}: {
  budgetId: string;
  currency: string;
  role: Role;
}) {
  const canEdit = RANK[role] >= RANK.editor;

  const route = useRoute();
  const routeAccountId = route.name === 'budget' ? route.accountId : null;

  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [error, setError] = useState<string | null>(null);

  const [editingCategoryFor, setEditingCategoryFor] = useState<string | null>(
    null,
  );
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const payeeRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState('');
  const [mode, setMode] = useState<Mode>('expense');
  const [payee, setPayee] = useState('');
  const [amount, setAmount] = useState('');
  const [isIncome, setIsIncome] = useState(false);
  const [date, setDate] = useState(today());
  const [memo, setMemo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [transferAccountId, setTransferAccountId] = useState('');

  // The `account` query parameter filters the list; an unknown id means all accounts.
  const filterAccountId =
    routeAccountId && accounts.some((account) => account.id === routeAccountId)
      ? routeAccountId
      : null;

  const loadTransactions = () =>
    api
      .listTransactions(budgetId, {
        month,
        accountId: filterAccountId ?? undefined,
      })
      .then(({ transactions }) => {
        setTransactions(transactions);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    loadTransactions();
  }, [budgetId, month, filterAccountId]);

  useEffect(() => {
    Promise.all([api.listAccounts(budgetId), api.listGroups(budgetId)])
      .then(([accountResult, groupResult]) => {
        setAccounts(accountResult.accounts);
        setGroups(groupResult.groups);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [budgetId]);

  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  // A new month or budget means stale row ids; start the selection fresh.
  useEffect(() => {
    setSelected([]);
  }, [budgetId, month]);

  const accountNames: Record<string, string> = {};
  for (const account of accounts) accountNames[account.id] = account.name;

  const categoryNames: Record<string, string> = {};
  for (const group of groups) {
    for (const category of group.categories) {
      categoryNames[category.id] = category.name;
    }
  }

  const categoryLabel = (transaction: Transaction): string => {
    if (transaction.transferTransactionId) return 'Transfer';
    if (!transaction.categoryId) return 'Ready to assign';
    return categoryNames[transaction.categoryId] ?? 'Uncategorized';
  };

  const isEditable = (transaction: Transaction) =>
    canEdit && !transaction.transferTransactionId;

  const toggleSelected = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );

  const commitCategory = async (transaction: Transaction, value: string) => {
    setEditingCategoryFor(null);
    const nextCategoryId = value || null;
    if (nextCategoryId === transaction.categoryId) return;
    try {
      await api.updateTransaction(budgetId, transaction.id, {
        categoryId: nextCategoryId,
      });
      setRowErrors((prev) => {
        const next = { ...prev };
        delete next[transaction.id];
        return next;
      });
      await loadTransactions();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [transaction.id]: errorMessage(err),
      }));
    }
  };

  const applyBulk = async () => {
    if (selected.length === 0) return;
    setBulkBusy(true);
    try {
      for (const id of selected) {
        await api.updateTransaction(budgetId, id, {
          categoryId: bulkCategory || null,
        });
      }
      setSelected([]);
      setBulkCategory('');
      setError(null);
      await loadTransactions();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  };

  const cents = Math.round(Number(amount) * 100);
  const amountValid =
    amount.trim() !== '' && Number.isFinite(cents) && cents > 0;
  const transferTargets = accounts.filter((account) => account.id !== accountId);
  const canSubmit =
    canEdit &&
    accountId !== '' &&
    payee.trim() !== '' &&
    amountValid &&
    date !== '' &&
    (mode === 'expense' || transferAccountId !== '');

  const lastForPayee = (name: string) =>
    (transactions ?? []).find(
      (t) => t.payee.toLowerCase() === name.trim().toLowerCase() && t.transferTransactionId === null,
    );

  const pickPayee = (name: string) => {
    setPayee(name);
    const match = lastForPayee(name);
    if (match && categoryId === '' && amount === '') {
      setCategoryId(match.categoryId ?? '');
      setIsIncome(match.amountMinor > 0);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        payeeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const input: TransactionInput = {
      accountId,
      payee: payee.trim(),
      amountMinor: mode === 'transfer' ? -cents : isIncome ? cents : -cents,
      date,
    };
    if (memo.trim()) input.memo = memo.trim();
    if (mode === 'transfer') input.transferAccountId = transferAccountId;
    else if (categoryId) input.categoryId = categoryId;
    try {
      await api.createTransaction(budgetId, input);
      setPayee('');
      setAmount('');
      setMemo('');
      setIsIncome(false);
      await loadTransactions();
      payeeRef.current?.focus();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (transaction: Transaction) => {
    const prompt = transaction.transferTransactionId
      ? 'Delete this transfer? Both sides are removed.'
      : 'Delete this transaction?';
    if (!window.confirm(prompt)) return;
    try {
      await api.deleteTransaction(budgetId, transaction.id);
      setSelected((prev) => prev.filter((id) => id !== transaction.id));
      await loadTransactions();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section>
      {error && <div className="error">{error}</div>}

      <div className="month-nav">
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setMonth(shiftMonth(month, -1))}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="month-label">{monthLabel(month)}</span>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => setMonth(shiftMonth(month, 1))}
          aria-label="Next month"
        >
          ›
        </button>
        <select
          className="select"
          value={filterAccountId ?? ''}
          onChange={(e) => {
            const account = e.target.value;
            const base = `/budgets/${encodeURIComponent(budgetId)}/transactions`;
            navigate(
              account ? `${base}?account=${encodeURIComponent(account)}` : base,
            );
          }}
          aria-label="Filter by account"
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </div>

      {canEdit && selected.length > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.length} selected</span>
          <select
            className="select"
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            aria-label="Category for selected transactions"
          >
            <CategoryOptions groups={groups} />
          </select>
          <button
            className="btn btn-primary btn-sm"
            onClick={applyBulk}
            disabled={bulkBusy}
          >
            Apply
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSelected([])}
            disabled={bulkBusy}
          >
            Clear
          </button>
        </div>
      )}

      <table className="budget-grid">
        <thead>
          <tr>
            {canEdit && <th className="check-col" />}
            <th>Date</th>
            <th>Account</th>
            <th>Payee</th>
            <th>Category</th>
            <th className="right">Amount</th>
            <th>Memo</th>
            {canEdit && <th className="right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {transactions?.map((transaction) => (
            <tr key={transaction.id}>
              {canEdit && (
                <td className="check-col">
                  {isEditable(transaction) && (
                    <input
                      type="checkbox"
                      checked={selected.includes(transaction.id)}
                      onChange={() => toggleSelected(transaction.id)}
                      aria-label={`Select ${transaction.payee}`}
                    />
                  )}
                </td>
              )}
              <td className="muted">{transaction.date}</td>
              <td>{accountNames[transaction.accountId] ?? transaction.accountId}</td>
              <td>{transaction.payee}</td>
              <td
                className={
                  transaction.transferTransactionId || !transaction.categoryId
                    ? 'muted'
                    : ''
                }
              >
                {transaction.transferTransactionId || !canEdit ? (
                  categoryLabel(transaction)
                ) : editingCategoryFor === transaction.id ? (
                  <select
                    className="select category-select"
                    autoFocus
                    defaultValue={transaction.categoryId ?? ''}
                    onChange={(e) =>
                      commitCategory(transaction, e.target.value)
                    }
                    onBlur={() => setEditingCategoryFor(null)}
                    aria-label="Category"
                  >
                    <CategoryOptions
                      groups={groups}
                      selected={
                        transaction.categoryId
                          ? {
                              id: transaction.categoryId,
                              name:
                                categoryNames[transaction.categoryId] ??
                                'Archived category',
                            }
                          : undefined
                      }
                    />
                  </select>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn-link category-trigger"
                      onClick={() => setEditingCategoryFor(transaction.id)}
                    >
                      {categoryLabel(transaction)}
                      {!transaction.categoryId && (
                        <span className="category-hint">Choose category</span>
                      )}
                    </button>
                    {rowErrors[transaction.id] && (
                      <span className="row-error">
                        {rowErrors[transaction.id]}
                      </span>
                    )}
                  </>
                )}
              </td>
              <td className="right">
                <span
                  className={
                    transaction.amountMinor < 0
                      ? 'num negative'
                      : transaction.amountMinor > 0
                        ? 'num positive'
                        : 'num muted'
                  }
                >
                  {formatMoney(transaction.amountMinor, currency)}
                </span>
              </td>
              <td className="muted">{transaction.memo ?? ''}</td>
              {canEdit && (
                <td className="right">
                  <button
                    className="btn-link danger"
                    onClick={() => remove(transaction)}
                  >
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
          {transactions?.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 8 : 6} className="muted">
                No transactions this month.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {canEdit && (
        <form className="register-form" onSubmit={submit}>
          <select
            className="select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            aria-label="Account"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            aria-label="Transaction type"
          >
            <option value="expense">Expense / income</option>
            <option value="transfer">Transfer</option>
          </select>
          <input
            className="input payee"
            placeholder="Payee"
            ref={payeeRef}
            list="payee-options"
            autoComplete="off"
            value={payee}
            onChange={(e) => pickPayee(e.target.value)}
            aria-label="Payee"
          />
          <input
            className="input amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Amount in dollars"
          />
          {mode === 'expense' ? (
            <>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={isIncome}
                  onChange={(e) => setIsIncome(e.target.checked)}
                />
                Income
              </label>
              <select
                className="select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                aria-label="Category"
              >
                <CategoryOptions
                  groups={groups}
                  placeholder="Ready to assign (income)"
                />
              </select>
            </>
          ) : (
            <select
              className="select"
              value={transferAccountId}
              onChange={(e) => setTransferAccountId(e.target.value)}
              aria-label="To account"
            >
              <option value="">To account…</option>
              {transferTargets.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          )}
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date"
          />
          <input
            className="input memo"
            placeholder="Memo (optional)"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            aria-label="Memo"
          />
          <button className="btn btn-primary" disabled={!canSubmit}>
            Add
          </button>
          <datalist id="payee-options">
            {Array.from(new Set((transactions ?? []).map((t) => t.payee))).map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </form>
      )}

      {canEdit && (
        <p className="muted entry-hint">
          Keyboard entry: press <kbd>N</kbd> to jump to Payee, <kbd>Tab</kbd> between fields,{' '}
          <kbd>Enter</kbd> to save. Known payees fill their last category.
        </p>
      )}

      {canEdit && accounts.length > 0 && (
        <CsvImport
          budgetId={budgetId}
          currency={currency}
          accounts={accounts}
          accountId={accountId || accounts[0].id}
          existing={transactions ?? []}
          onDone={() => { loadTransactions(); }}
        />
      )}
    </section>
  );
}
