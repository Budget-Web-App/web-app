import { useEffect, useState } from 'react';
import { Budget, Role, api, errorMessage } from './api';
import { AccountsView } from './AccountsView';
import { BudgetSidebar } from './BudgetSidebar';
import { ReportsView } from './ReportsView';
import { MembersView } from './MembersView';
import { MonthView } from './MonthView';
import { TransactionsView } from './TransactionsView';
import { TabId, useRoute } from './router';

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

export function BudgetDetail({
  budget,
  onBack,
  onOpenSettings,
  onChanged,
  onDeleted,
}: {
  budget: Budget;
  onBack: () => void;
  onOpenSettings: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const route = useRoute();
  const tab: TabId = route.name === 'budget' ? route.tab : 'month';
  const [rename, setRename] = useState(budget.name);
  const [error, setError] = useState<string | null>(null);

  const can = (minimum: Role) => RANK[budget.role] >= RANK[minimum];

  useEffect(() => setRename(budget.name), [budget.name]);

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
    <section className="budget-layout">
      <BudgetSidebar
        onOpenSettings={onOpenSettings}
        budgetId={budget.id}
        budgetName={budget.name}
        tab={tab}
        onBack={onBack}
      />

      <div className="budget-main">
        {error && <div className="error">{error}</div>}

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
            onChanged={() => undefined}
          />
        )}
        {tab === 'transactions' && (
          <TransactionsView
            budgetId={budget.id}
            currency={budget.currency}
            role={budget.role}
          />
        )}
        {tab === 'reports' && (
          <ReportsView budgetId={budget.id} currency={budget.currency} />
        )}
        {tab === 'members' && (
          <MembersView budgetId={budget.id} myRole={budget.role} />
        )}

        {can('editor') && (
          <details className="budget-settings">
            <summary>Budget settings</summary>
            <div className="detail-head">
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
              {can('owner') && (
                <button className="btn btn-danger" onClick={deleteBudget}>
                  Delete budget
                </button>
              )}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
