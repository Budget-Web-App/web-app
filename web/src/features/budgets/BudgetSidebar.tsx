import { AccountType } from '../../lib/api';
import { Link } from '../../app/Link';
import { TabId } from '../../app/router';
import { GearIcon } from './SettingsDialog';

export const TAB_LABELS: Record<TabId, string> = {
  month: 'Budget',
  transactions: 'Transactions',
  accounts: 'Accounts',
  reports: 'Reports',
  members: 'Members',
};

const NAV: TabId[] = ['month', 'transactions', 'accounts', 'reports'];

export const ACCOUNT_GROUPS: { label: string; types: AccountType[] }[] = [
  { label: 'Cash', types: ['checking', 'savings'] },
  { label: 'Credit cards', types: ['credit'] },
];

/** Section navigation for the budget detail screen, with Settings pinned below a divider. */
export function BudgetSidebar({
  budgetId,
  budgetName,
  tab,
  onOpenSettings,
}: {
  budgetId: string;
  budgetName: string;
  tab: TabId;
  onOpenSettings: () => void;
}) {
  const base = `/budgets/${encodeURIComponent(budgetId)}`;
  return (
    <aside className="budget-sidebar">
      <Link className="sidebar-back" to="/">
        ‹ All budgets
      </Link>
      <p className="sidebar-title" title={budgetName}>
        {budgetName}
      </p>

      <nav className="side-nav" aria-label="Budget sections">
        {NAV.map((id) => (
          <Link
            key={id}
            to={id === 'month' ? base : `${base}/${id}`}
            className="side-link"
            aria-current={tab === id ? 'page' : undefined}
          >
            {TAB_LABELS[id]}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="side-link settings-link" onClick={onOpenSettings}>
          <GearIcon /> Settings
        </button>
      </div>
    </aside>
  );
}
