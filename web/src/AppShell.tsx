import { FormEvent, useEffect, useState } from 'react';
import { Budget, User, api, errorMessage } from './api';
import { BudgetDetail } from './BudgetDetail';
import { dateLabel } from './format';
import { GearIcon, SettingsDialog } from './SettingsDialog';
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
  const [showSettings, setShowSettings] = useState(false);
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
    <div className={route.name === 'budget' ? 'app no-topbar' : 'app'}>
      {route.name !== 'budget' && (
      <header className="topbar">
        <div className="brand">
          <span className="brand-logo" aria-hidden="true">1</span>
          OneBudget
        </div>
      </header>
      )}

      <div className={route.name === 'budget' && selected ? 'content wide' : 'content'}>
        {error && <div className="error">{error}</div>}

        {budgets === null ? (
          <p className="muted">Loading…</p>
        ) : route.name === 'budget' ? (
          selected ? (
            <BudgetDetail
              budget={selected}
              onBack={() => navigate('/')}
              onOpenSettings={() => setShowSettings(true)}
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
                    <span className={`role-badge ${budget.role}`}>
                      {budget.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {route.name !== 'budget' && (
        <button className="settings-dock" onClick={() => setShowSettings(true)}>
          <GearIcon /> Settings
        </button>
      )}
      {showSettings && (
        <SettingsDialog
          user={user}
          budget={route.name === 'budget' && selected ? selected : undefined}
          onChanged={refresh}
          onDeleted={() => {
            setShowSettings(false);
            navigate('/');
            refresh();
          }}
          onSignOut={onSignOut}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
