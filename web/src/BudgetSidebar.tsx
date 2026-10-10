import { AccountType } from './api';
import { TabId, navigate } from './router';
import { GearIcon } from './SettingsDialog';

const NAV: [TabId, string][] = [
  ['month', 'Budget'],
  ['transactions', 'Transactions'],
  ['accounts', 'Accounts'],
  ['reports', 'Reports'],
];

export const ACCOUNT_GROUPS: { label: string; types: AccountType[] }[] = [
  { label: 'Cash', types: ['checking', 'savings'] },
  { label: 'Credit cards', types: ['credit'] },
];

/** Section navigation for the budget detail screen, with Settings pinned below a divider. */
export function BudgetSidebar({
  budgetId,
  budgetName,
  tab,
  onBack,
  onOpenSettings,
}: {
  budgetId: string;
  budgetName: string;
  tab: TabId;
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  const base = `/budgets/${encodeURIComponent(budgetId)}`;
  return (
    <aside className="budget-sidebar">
      <button className="sidebar-back" onClick={onBack}>
        ‹ All budgets
      </button>
      <h1 className="sidebar-title" title={budgetName}>
        {budgetName}
      </h1>

      <nav className="side-nav" aria-label="Budget sections">
        {NAV.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'side-link active' : 'side-link'}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => navigate(id === 'month' ? base : `${base}/${id}`)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="side-link settings-link" onClick={onOpenSettings}>
          <GearIcon /> Settings
        </button>
      </div>
    </aside>
  );
}
