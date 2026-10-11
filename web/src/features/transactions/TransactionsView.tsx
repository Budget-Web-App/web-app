import { useEffect, useMemo, useRef, useState } from 'react';
import { CsvImport } from './CsvImport';
import { CategoryOptions } from './CategoryOptions';
import { TransactionComposer } from './TransactionComposer';
import {
  Account,
  CategoryGroup,
  Role,
  Transaction,
  TransactionInput,
  api,
  errorMessage,
} from '../../lib/api';
import { currentMonth, formatMoney, monthLabel } from '../../lib/format';
import { isTypingTarget, useGlobalKey } from '../../lib/hooks';
import { Loading } from '../../lib/Loading';
import { Menu, DotsIcon } from '../../lib/Menu';
import { Modal, useConfirm } from '../../lib/Modal';
import { MonthSwitcher } from '../month/MonthPicker';
import { PlusIcon } from '../categories/NameComposer';
import { navigate, useRoute } from '../../app/router';
import { hasRole } from '../../lib/roles';
import { AccountHeader, HeaderBoundary } from '../accounts/AccountHeader';
import { todayIso } from '../accounts/shared';

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const ymd = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (iso === todayIso()) return 'Today';
  if (iso === ymd(yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
  const canEdit = hasRole(role, 'editor');

  const route = useRoute();
  const routeAccountId = route.name === 'budget' ? route.accountId : null;

  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [composing, setComposing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState('');
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);

  const [editingCategoryFor, setEditingCategoryFor] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const latestRequest = useRef(0);

  // The `account` query parameter filters the list; an unknown id means all accounts.
  const filterAccountId =
    routeAccountId && accounts.some((account) => account.id === routeAccountId)
      ? routeAccountId
      : null;

  // Only the newest request may write state, so a slow response for an old
  // month or account can never overwrite the list the person is looking at.
  const loadTransactions = async () => {
    const id = ++latestRequest.current;
    try {
      const { transactions } = await api.listTransactions(budgetId, {
        month,
        accountId: filterAccountId ?? undefined,
      });
      if (id !== latestRequest.current) return;
      setTransactions(transactions);
      setVersion((v) => v + 1);
      setError(null);
    } catch (err) {
      if (id === latestRequest.current) setError(errorMessage(err));
    }
  };

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

  // A new month, account or budget means stale row ids; start the selection fresh.
  useEffect(() => {
    setSelected([]);
  }, [budgetId, month, filterAccountId]);

  const accountNames = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a.name])) as Record<string, string>,
    [accounts],
  );
  const categoryNames = useMemo(
    () =>
      Object.fromEntries(
        groups.flatMap((g) => g.categories.map((c) => [c.id, c.name])),
      ) as Record<string, string>,
    [groups],
  );

  const isEditable = (t: Transaction) => canEdit && !t.transferTransactionId;
  const needsCategory = (t: Transaction) =>
    !t.transferTransactionId && !t.categoryId && t.amountMinor < 0;
  const categoryLabel = (t: Transaction): string => {
    if (t.transferTransactionId) return 'Transfer';
    if (!t.categoryId) return needsCategory(t) ? 'Needs category' : 'Ready to assign';
    return categoryNames[t.categoryId] ?? 'Uncategorized';
  };

  const all = transactions ?? [];
  const needsCount = all.filter(needsCategory).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...all]
      .filter((t) => !onlyUncategorized || needsCategory(t))
      .filter(
        (t) =>
          !q ||
          t.payee.toLowerCase().includes(q) ||
          (t.memo ?? '').toLowerCase().includes(q) ||
          categoryLabel(t).toLowerCase().includes(q) ||
          (accountNames[t.accountId] ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [transactions, query, onlyUncategorized, categoryNames, accountNames]);

  const days = useMemo(() => {
    const out: { date: string; rows: Transaction[] }[] = [];
    for (const t of visible) {
      const last = out[out.length - 1];
      if (last && last.date === t.date) last.rows.push(t);
      else out.push({ date: t.date, rows: [t] });
    }
    return out;
  }, [visible]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const editableIds = visible.filter(isEditable).map((t) => t.id);
  const allSelected = editableIds.length > 0 && editableIds.every((id) => selectedSet.has(id));
  const toggleSelected = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  const openComposer = () => {
    setComposing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useGlobalKey((e) => {
    if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
      if (!canEdit || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      openComposer();
    }
  });

  const addTransaction = async (input: TransactionInput) => {
    await api.createTransaction(budgetId, input);
    await loadTransactions();
  };

  const commitCategory = async (t: Transaction, value: string) => {
    setEditingCategoryFor(null);
    const next = value || null;
    if (next === t.categoryId) return;
    try {
      await api.updateTransaction(budgetId, t.id, { categoryId: next });
      setRowErrors((prev) => {
        const copy = { ...prev };
        delete copy[t.id];
        return copy;
      });
      await loadTransactions();
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [t.id]: errorMessage(err) }));
    }
  };

  const toggleCleared = async (t: Transaction) => {
    try {
      await api.updateTransaction(budgetId, t.id, {
        cleared: t.cleared === 'cleared' ? 'uncleared' : 'cleared',
      });
      await loadTransactions();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const applyBulk = async () => {
    if (selected.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      selected.map((id) => api.updateTransaction(budgetId, id, { categoryId: bulkCategory || null })),
    );
    // Keep the rows that failed selected so the person can retry just those.
    const failedIds = selected.filter((_, i) => results[i].status === 'rejected');
    setSelected(failedIds);
    if (failedIds.length === 0) {
      setBulkCategory('');
      setError(null);
    } else {
      setError(`${failedIds.length} of ${results.length} transactions could not be updated.`);
    }
    await loadTransactions();
    setBulkBusy(false);
  };

  const remove = async (t: Transaction) => {
    const ok = await confirm({
      title: t.transferTransactionId ? 'Delete this transfer?' : 'Delete this transaction?',
      message: t.transferTransactionId
        ? `${t.payee} and its matching transfer on the other account are both removed.`
        : `${t.payee} on ${t.date} is removed from your budget.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteTransaction(budgetId, t.id);
      setSelected((prev) => prev.filter((id) => id !== t.id));
      await loadTransactions();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const filtering = query.trim() !== '' || onlyUncategorized;
  const currentAccount = filterAccountId ? accounts.find((a) => a.id === filterAccountId) : undefined;

  const categoryControl = (t: Transaction) => {
    const label = categoryLabel(t);
    if (t.transferTransactionId || !canEdit) return <span className="chip chip-static">{label}</span>;
    if (editingCategoryFor === t.id) {
      return (
        <select
          className="select category-select"
          autoFocus
          defaultValue={t.categoryId ?? ''}
          onChange={(e) => commitCategory(t, e.target.value)}
          onBlur={() => setEditingCategoryFor(null)}
          aria-label="Category"
        >
          <CategoryOptions
            groups={groups}
            selected={
              t.categoryId
                ? { id: t.categoryId, name: categoryNames[t.categoryId] ?? 'Archived category' }
                : undefined
            }
          />
        </select>
      );
    }
    return (
      <>
        <button
          type="button"
          className={`chip${needsCategory(t) ? ' chip-needs' : !t.categoryId ? ' chip-muted' : ''}`}
          aria-label={`Category for ${t.payee}: ${label}. Change`}
          onClick={() => setEditingCategoryFor(t.id)}
        >
          {label}
        </button>
        {rowErrors[t.id] && <span className="row-error">{rowErrors[t.id]}</span>}
      </>
    );
  };

  return (
    <section className="txns">
      {error && <div className="error" role="alert">{error}</div>}

      {currentAccount && (
        <HeaderBoundary
          key={currentAccount.id}
          fallback={<h2 className="acct-title">{currentAccount.name}</h2>}
        >
          <AccountHeader
            budgetId={budgetId}
            currency={currency}
            account={currentAccount}
            canEdit={canEdit}
            version={version}
            onAddTransaction={openComposer}
            onChanged={loadTransactions}
          />
        </HeaderBoundary>
      )}

      {!currentAccount && <h2 className="acct-title txn-title">Transactions</h2>}

      <div className="txn-toolbar">
        <MonthSwitcher month={month} onChange={setMonth} />
        {!filterAccountId && accounts.length > 1 && (
          <select
            className="select"
            value=""
            onChange={(e) =>
              navigate(`/budgets/${encodeURIComponent(budgetId)}/transactions?account=${encodeURIComponent(e.target.value)}`)
            }
            aria-label="Show one account"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <div className="txn-tools">
          {all.length > 0 && (
            <input
              type="search"
              className="input txn-search"
              placeholder="Search"
              aria-label="Search transactions"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          )}
          {canEdit && !composing && !currentAccount && (
            <button className="btn btn-primary" onClick={openComposer} title="Press N">
              <PlusIcon /> Add transaction
            </button>
          )}
          {canEdit && (
            <Menu label="More actions" trigger={<DotsIcon />}>
              {(done) => (
                <button
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    done();
                    setImporting(true);
                  }}
                >
                  Import from CSV
                </button>
              )}
            </Menu>
          )}
        </div>
      </div>

      {composing && canEdit && accounts.length > 0 && (
        <TransactionComposer
          accounts={accounts}
          groups={groups}
          fixedAccountId={filterAccountId}
          currency={currency}
          known={all}
          onAdd={addTransaction}
          onClose={() => setComposing(false)}
        />
      )}

      {canEdit && needsCount > 0 && (
        <button
          className="txn-nudge"
          aria-pressed={onlyUncategorized}
          onClick={() => setOnlyUncategorized((v) => !v)}
        >
          {needsCount} {needsCount === 1 ? 'needs' : 'need'} a category
          <span>{onlyUncategorized ? 'Show all' : 'Review'}</span>
        </button>
      )}

      {canEdit && selected.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Bulk actions">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : editableIds)}
            />
            <span className="bulk-count" role="status">{selected.length} selected</span>
          </label>
          <select
            className="select"
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            aria-label="Category for selected transactions"
          >
            <CategoryOptions groups={groups} />
          </select>
          <button className="btn btn-primary btn-sm" onClick={applyBulk} disabled={bulkBusy}>
            Apply
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected([])} disabled={bulkBusy}>
            Clear
          </button>
        </div>
      )}

      {transactions === null ? (
        <Loading label="Loading transactions" />
      ) : days.length === 0 ? (
        <div className="acct-empty">
          <p className="acct-empty-text">
            {filtering
              ? 'Nothing matches.'
              : `No transactions in ${monthLabel(month)}.`}
          </p>
          {filtering ? (
            <button
              className="btn"
              onClick={() => {
                setQuery('');
                setOnlyUncategorized(false);
              }}
            >
              Clear filters
            </button>
          ) : (
            canEdit && (
              <div className="acct-actions">
                <button className="btn btn-primary" onClick={openComposer}>
                  <PlusIcon /> Add transaction
                </button>
                <button className="btn" onClick={() => setImporting(true)}>
                  Import from CSV
                </button>
              </div>
            )
          )}
        </div>
      ) : (
        <ul className={`txn-list${selected.length > 0 ? ' selecting' : ''}`} aria-label="Transactions">
          {days.map((day) => (
            <li key={day.date} className="txn-day-group">
              <h3 className="txn-day">{dayLabel(day.date)}</h3>
              <ul>
                {day.rows.map((t) => (
                  <li key={t.id} className={`txn-row${selectedSet.has(t.id) ? ' is-selected' : ''}`}>
                    {isEditable(t) ? (
                      <input
                        type="checkbox"
                        className="txn-check"
                        checked={selectedSet.has(t.id)}
                        onChange={() => toggleSelected(t.id)}
                        aria-label={`Select ${t.payee}`}
                      />
                    ) : (
                      <span aria-hidden="true" />
                    )}
                    <div className="txn-main">
                      <span className="txn-payee">{t.payee}</span>
                      {(!filterAccountId || t.memo) && (
                        <span className="txn-sub">
                          {[!filterAccountId && (accountNames[t.accountId] ?? ''), t.memo]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </div>
                    <div className="txn-cat">{categoryControl(t)}</div>
                    <span className={`txn-amt num${t.amountMinor > 0 ? ' positive' : ''}`}>
                      {formatMoney(t.amountMinor, currency)}
                    </span>
                    <button
                      type="button"
                      className={`clr${t.cleared === 'cleared' ? ' on' : ''}`}
                      aria-pressed={t.cleared === 'cleared'}
                      aria-label={`${t.payee}, ${t.date}: ${t.cleared}`}
                      title={t.cleared === 'cleared' ? 'Cleared' : 'Uncleared'}
                      disabled={!canEdit}
                      onClick={() => toggleCleared(t)}
                    >
                      C
                    </button>
                    {canEdit ? (
                      <Menu label={`Actions for ${t.payee}`} trigger={<DotsIcon />}>
                        {(done) => (
                          <button
                            role="menuitem"
                            className="menu-item danger"
                            onClick={() => {
                              done();
                              void remove(t);
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </Menu>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {importing && accounts.length > 0 && (
        <Modal title="Import from CSV" size="lg" onClose={() => setImporting(false)}>
          <CsvImport
            budgetId={budgetId}
            currency={currency}
            accounts={accounts.filter((a) => !a.closed)}
            accountId={filterAccountId ?? accounts.find((a) => !a.closed)?.id ?? accounts[0].id}
            existing={all}
            onDone={loadTransactions}
          />
          <div className="modal-actions">
            <button className="btn" onClick={() => setImporting(false)}>
              Done
            </button>
          </div>
        </Modal>
      )}
      {confirmDialog}
    </section>
  );
}
