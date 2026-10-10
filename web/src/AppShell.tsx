import { FormEvent, useEffect, useState } from 'react';
import { Budget, User, api, errorMessage } from './api';
import { BudgetDetail } from './BudgetDetail';
import { dateLabel } from './format';
import { findBudget, navigate, useRoute } from './router';

export function AppShell({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const route = useRoute();

  const refresh = () =>
    api
      .listBudgets()
      .then(({ budgets }) => setBudgets(budgets))
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    refresh();
  }, []);

  const createBudget = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    try {
      const { budget } = await api.createBudget(newName.trim());
      setNewName('');
      await refresh();
      navigate('/budgets/' + encodeURIComponent(budget.id));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const selected = findBudget(route, budgets);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">OneBudget</div>
        <div className="spacer" />
        <span className="user-chip">
          {user.name}
          <span className="user-email">{user.email}</span>
        </span>
        <button className="btn btn-ghost btn-sm" onClick={onSignOut}>
          Sign out
        </button>
      </header>

      <div className="content">
        {error && <div className="error">{error}</div>}

        {budgets === null ? (
          <p className="muted">Loading…</p>
        ) : route.name === 'budget' ? (
          selected ? (
            <BudgetDetail
              budget={selected}
              onBack={() => navigate('/')}
              onChanged={refresh}
              onDeleted={() => {
                navigate('/');
                refresh();
              }}
            />
          ) : (
            <div className="empty">
              <p className="empty-title">Budget not found</p>
              <p className="muted">
                It may have been deleted, or you may not have access to it.
              </p>
              <button className="btn-link" onClick={() => navigate('/')}>
                Back to budgets
              </button>
            </div>
          )
        ) : (
          <>
            <h1 className="page-title">Budgets</h1>
            <p className="page-lede">
              Each budget has its own accounts, categories, and members.
            </p>

            <form className="create-row" onSubmit={createBudget}>
              <input
                className="input"
                placeholder="New budget, for example Household"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                aria-label="New budget name"
              />
              <button className="btn btn-primary" disabled={!newName.trim()}>
                Create
              </button>
            </form>

            {budgets.length === 0 ? (
              <div className="empty">
                <p className="empty-title">No budgets yet</p>
                <p className="muted">
                  Create one above and give every dollar a job.
                </p>
              </div>
            ) : (
              <div className="ledger" role="list">
                {budgets.map((budget) => (
                  <button
                    key={budget.id}
                    className="ledger-row"
                    onClick={() =>
                      navigate('/budgets/' + encodeURIComponent(budget.id))
                    }
                    role="listitem"
                  >
                    <span className="ledger-name">{budget.name}</span>
                    <span className="ledger-meta">
                      Created {dateLabel(budget.createdAt)}
                    </span>
                    <span
                      className={
                        budget.role === 'owner'
                          ? 'role-badge owner'
                          : 'role-badge'
                      }
                    >
                      {budget.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
