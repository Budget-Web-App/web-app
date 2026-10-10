import { Budget } from './api';
import { AccountsView } from './AccountsView';
import { BudgetSidebar } from './BudgetSidebar';
import { ReportsView } from './ReportsView';
import { MembersView } from './MembersView';
import { MonthView } from './MonthView';
import { TransactionsView } from './TransactionsView';
import { TabId, useRoute } from './router';

export function BudgetDetail({
  budget,
  onBack,
  onOpenSettings,
}: {
  budget: Budget;
  onBack: () => void;
  onOpenSettings: () => void;
}) {
  const route = useRoute();
  const tab: TabId = route.name === 'budget' ? route.tab : 'month';

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
      </div>
    </section>
  );
}
