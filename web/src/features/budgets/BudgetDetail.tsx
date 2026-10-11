import { Suspense, lazy } from 'react';
import { Budget } from '../../lib/api';
import { Loading } from '../../lib/Loading';
import { BudgetSidebar, TAB_LABELS } from './BudgetSidebar';
import { MonthView } from '../month/MonthView';
import { TabId, useRoute } from '../../app/router';

// The Budget tab is the landing screen and ships in the main bundle. The other
// tabs load on first visit, which keeps the first paint small.
const AccountsView = lazy(() =>
  import('../accounts/AccountsView').then((m) => ({ default: m.AccountsView })),
);
const TransactionsView = lazy(() =>
  import('../transactions/TransactionsView').then((m) => ({ default: m.TransactionsView })),
);
const ReportsView = lazy(() =>
  import('../reports/ReportsView').then((m) => ({ default: m.ReportsView })),
);
const MembersView = lazy(() =>
  import('../members/MembersView').then((m) => ({ default: m.MembersView })),
);

export function BudgetDetail({
  budget,
  onOpenSettings,
}: {
  budget: Budget;
  onOpenSettings: () => void;
}) {
  const route = useRoute();
  const tab: TabId = route.name === 'budget' ? route.tab : 'month';

  return (
    <div className="budget-layout">
      <BudgetSidebar
        onOpenSettings={onOpenSettings}
        budgetId={budget.id}
        budgetName={budget.name}
        tab={tab}
      />

      <main id="main" tabIndex={-1} className="budget-main">
        <h1 className="visually-hidden">
          {TAB_LABELS[tab]}, {budget.name}
        </h1>
        <Suspense fallback={<Loading />}>
          {tab === 'month' && (
            <MonthView budgetId={budget.id} currency={budget.currency} role={budget.role} />
          )}
          {tab === 'accounts' && (
            <AccountsView budgetId={budget.id} currency={budget.currency} role={budget.role} />
          )}
          {tab === 'transactions' && (
            <TransactionsView budgetId={budget.id} currency={budget.currency} role={budget.role} />
          )}
          {tab === 'reports' && <ReportsView budgetId={budget.id} currency={budget.currency} />}
          {tab === 'members' && <MembersView budgetId={budget.id} myRole={budget.role} />}
        </Suspense>
      </main>
    </div>
  );
}
