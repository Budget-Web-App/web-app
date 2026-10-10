import { useEffect, useState } from 'react';
import { Budget, Role, api, errorMessage } from './api';
import { AccountsView } from './AccountsView';
import { BudgetSidebar } from './BudgetSidebar';
import { MembersView } from './MembersView';
import { MonthView } from './MonthView';
import { TransactionsView } from './TransactionsView';
import { TabId, navigate, useRoute } from './router';

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

export function BudgetDetail({
  budget,
  onBack,
  onChanged,
  onDeleted,
}: {
  budget: Budget;
  onBack: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const route = useRoute();
  const tab: TabId = route.name === 'budget' ? route.tab : 'month';
  const activeAccountId = route.name === 'budget' ? route.accountId : null;
  const [rename, setRename] = useState(budget.name);
  const [error, setError] = useState<string | null>(null);
  // Bumped when the Accounts tab changes accounts, so the sidebar refetches.
  const [accountsVersion, setAccountsVersion] = useState(0);

  const can = (minimum: Role) => RANK[budget.role] >= RANK[minimum];

  useEffect(() => setRename(budget.name), [budget.name]);

  // The `budget` tab is canonical at the bare budget path; the other tabs append their id.
  const tabPath = (id: TabId) =>
    id === 'month'
      ? `/budgets/${encodeURIComponent(budget.id)}`
      : `/budgets/${encodeURIComponent(budget.id)}/${id}`;

  const saveName = async () => {
    if (!rename.trim() || rename === budget.name) return;
    setError(null);
    try {
      await api.renameBudget(budget.id, rename.trim());
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const deleteBudget = async () => {
    if (
      !window.confirm(
        `Delete "${budget.name}" and all of its data? This cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api.deleteBudget(budget.id);
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section>
      <button className="btn-link" onClick={onBack}>
        Budgets
      </button>

      <div className="budget-layout">
        <BudgetSidebar
          budgetId={budget.id}
          budgetName={budget.name}
          currency={budget.currency}
          activeAccountId={activeAccountId}
          version={accountsVersion}
        />

        <div className="budget-main">
          <div className="detail-head">
            <div className="detail-title">
              {can('editor') && (
                <div className="rename-row">
                  <input
                    className="input"
                    value={rename}
                    onChange={(e) => setRename(e.target.value)}
                    aria-label="Budget name"
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={saveName}
                    disabled={!rename.trim() || rename === budget.name}
                  >
                    Save name
                  </button>
                </div>
              )}
            </div>
            {can('owner') && (
              <button className="btn btn-danger" onClick={deleteBudget}>
                Delete budget
              </button>
            )}
          </div>

          {error && <div className="error">{error}</div>}

          <nav className="tabs" aria-label="Budget sections">
            {(
              [
                ['month', 'Budget'],
                ['accounts', 'Accounts'],
                ['transactions', 'Transactions'],
                ['members', 'Members'],
              ] as [TabId, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? 'tab active' : 'tab'}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => navigate(tabPath(id))}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === 'month' && (
            <MonthView
              budgetId={budget.id}
              currency={budget.currency}
              role={budget.role}
            />
          )}
          {tab === 'accounts' && (
            <AccountsView
              budgetId={budget.id}
              currency={budget.currency}
              role={budget.role}
              onChanged={() => setAccountsVersion((v) => v + 1)}
            />
          )}
          {tab === 'transactions' && (
            <TransactionsView
              budgetId={budget.id}
              currency={budget.currency}
              role={budget.role}
            />
          )}
          {tab === 'members' && (
            <MembersView budgetId={budget.id} myRole={budget.role} />
          )}
        </div>
      </div>
    </section>
  );
}
