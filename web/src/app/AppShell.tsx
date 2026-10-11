import { FormEvent, useEffect, useRef, useState } from 'react';
import { Budget, User, api, errorMessage } from '../lib/api';
import { BudgetDetail } from '../features/budgets/BudgetDetail';
import { TAB_LABELS } from '../features/budgets/BudgetSidebar';
import { dateLabel } from '../lib/format';
import { useDocumentTitle } from '../lib/hooks';
import { Loading } from '../lib/Loading';
import { GearIcon, SettingsDialog } from '../features/budgets/SettingsDialog';
import { Link } from './Link';
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
  const [creating, setCreating] = useState(false);
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
    if (!newName.trim() || creating) return;
    setError(null);
    setCreating(true);
    try {
      const { budget } = await api.createBudget(newName.trim());
      setNewName('');
      await refresh();
      navigate('/budgets/' + encodeURIComponent(budget.id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const inBudget = route.name === 'budget';
  const selected = findBudget(route, budgets);

  useDocumentTitle(
    inBudget && selected
      ? `${TAB_LABELS[route.tab]} · ${selected.name} · OneBudget`
      : 'Budgets · OneBudget',
  );

  // After an in-app navigation, move focus to the new screen so keyboard and
  // screen-reader users start at its top. The first render keeps the browser default.
  const routeKey = inBudget ? `${route.budgetId}/${route.tab}` : 'list';
  const firstRoute = useRef(true);
  useEffect(() => {
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [routeKey]);

  const settings = showSettings && (
    <SettingsDialog
      user={user}
      budget={inBudget && selected ? selected : undefined}
      onChanged={refresh}
      onDeleted={() => {
        setShowSettings(false);
        navigate('/');
        refresh();
      }}
      onSignOut={onSignOut}
      onClose={() => setShowSettings(false)}
    />
  );

  if (inBudget) {
    return (
      <div className="app no-topbar">
        <a className="skip-link" href="#main">Skip to content</a>
        {budgets === null ? (
          <main id="main" tabIndex={-1} className="content">
            {error && <div className="error" role="alert">{error}</div>}
            <Loading />
          </main>
        ) : selected ? (
          <div className="content wide">
            <BudgetDetail
              budget={selected}
              onOpenSettings={() => setShowSettings(true)}
            />
          </div>
        ) : (
          <main id="main" tabIndex={-1} className="content">
            <div className="empty">
              <p className="empty-title">Budget not found</p>
              <p className="muted">
                It may have been deleted, or you may not have access to it.
              </p>
              <Link className="btn-link" to="/">Back to budgets</Link>
            </div>
          </main>
        )}
        {settings}
      </div>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="OneBudget home">
          <span className="brand-logo" aria-hidden="true">1</span>
          OneBudget
        </Link>
        <div className="topbar-actions">
          <button type="button" className="side-link settings-link" onClick={() => setShowSettings(true)}>
            <GearIcon /> Settings
          </button>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="content">
        {error && <div className="error" role="alert">{error}</div>}
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
            autoComplete="off"
          />
          <button className="btn btn-primary" disabled={!newName.trim() || creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>

        {budgets === null ? (
          <Loading label="Loading budgets" />
        ) : budgets.length === 0 ? (
          <div className="empty">
            <p className="empty-title">No budgets yet</p>
            <p className="muted">Create one above and give every dollar a job.</p>
          </div>
        ) : (
          <ul className="ledger" aria-label="Your budgets">
            {budgets.map((budget) => (
              <li key={budget.id}>
                <Link className="ledger-row" to={'/budgets/' + encodeURIComponent(budget.id)}>
                  <span className="ledger-name">{budget.name}</span>
                  <span className="ledger-meta">Created {dateLabel(budget.createdAt)}</span>
                  <span className={`role-badge ${budget.role}`}>{budget.role}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      {settings}
    </div>
  );
}
