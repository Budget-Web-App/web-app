import { useEffect, useState } from 'react';
import { Account, AccountType, api, errorMessage } from './api';
import { formatMoney } from './format';
import { navigate } from './router';

export const ACCOUNT_GROUPS: { label: string; types: AccountType[] }[] = [
  { label: 'Cash', types: ['checking', 'savings'] },
  { label: 'Credit cards', types: ['credit'] },
];

/**
 * Persistent account sidebar for the budget detail screen. Clicking a row links
 * to the transactions tab, filtered through the `account` query parameter.
 */
export function BudgetSidebar({
  budgetId,
  budgetName,
  currency,
  activeAccountId,
  version,
}: {
  budgetId: string;
  budgetName: string;
  currency: string;
  activeAccountId: string | null;
  version: number;
}) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listAccounts(budgetId)
      .then(({ accounts }) => {
        setAccounts(accounts);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [budgetId, version]);

  const base = `/budgets/${encodeURIComponent(budgetId)}`;
  const open = (accounts ?? []).filter((account) => !account.closed);
  const total = open.reduce((sum, account) => sum + account.balanceMinor, 0);

  const row = (
    key: string,
    label: string,
    amountMinor: number,
    active: boolean,
    path: string,
  ) => (
    <button
      key={key}
      className={active ? 'sidebar-row active' : 'sidebar-row'}
      aria-current={active ? 'page' : undefined}
      onClick={() => navigate(path)}
    >
      <span className="sidebar-row-name">{label}</span>
      <span className={`sidebar-row-amount num pill ${amountMinor < 0 ? 'negative' : 'positive'}`}>
        {formatMoney(amountMinor, currency)}
      </span>
    </button>
  );

  return (
    <aside className="budget-sidebar" aria-label="Accounts">
      <h1 className="sidebar-title">{budgetName}</h1>

      {error && <div className="error small">{error}</div>}

      {accounts !== null && (
        <nav className="sidebar-nav">
          {row(
            'all',
            'All accounts',
            total,
            activeAccountId === null,
            `${base}/transactions`,
          )}
          {ACCOUNT_GROUPS.map((group) => {
            const rows = open.filter((account) =>
              group.types.includes(account.type),
            );
            if (rows.length === 0) return null;
            return (
              <div key={group.label} className="sidebar-group">
                <div className="sidebar-group-label">{group.label}</div>
                {rows.map((account) =>
                  row(
                    account.id,
                    account.name,
                    account.balanceMinor,
                    activeAccountId === account.id,
                    `${base}/transactions?account=${encodeURIComponent(account.id)}`,
                  ),
                )}
              </div>
            );
          })}
        </nav>
      )}

      <button
        className="btn-link sidebar-manage"
        onClick={() => navigate(`${base}/accounts`)}
      >
        Manage accounts
      </button>
    </aside>
  );
}
