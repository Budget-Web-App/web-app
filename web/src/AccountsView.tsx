import { FormEvent, useEffect, useState } from 'react';
import {
  Account,
  AccountType,
  Role,
  SyncProvider,
  SyncResult,
  api,
  errorMessage,
} from './api';
import { ACCOUNT_GROUPS } from './BudgetSidebar';
import { formatMoney } from './format';
import { navigate } from './router';
import { starterAccounts } from './starters';

const TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit card',
};

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

export function AccountsView({
  budgetId,
  currency,
  role,
  onChanged,
}: {
  budgetId: string;
  currency: string;
  role: Role;
  onChanged?: () => void;
}) {
  const canEdit = RANK[role] >= RANK.editor;

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [providers, setProviders] = useState<SyncProvider[]>([]);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .listAccounts(budgetId)
      .then(({ accounts }) => {
        setAccounts(accounts);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    load();
  }, [budgetId]);

  useEffect(() => {
    if (!canEdit) return;
    api
      .listSyncProviders(budgetId)
      .then(({ providers }) => setProviders(providers))
      .catch((err) => setError(errorMessage(err)));
  }, [budgetId, role]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.createAccount(budgetId, name.trim(), type);
      setName('');
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const addStarterAccounts = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      for (const account of starterAccounts) {
        await api.createAccount(budgetId, account.name, account.type);
      }
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const close = async (accountId: string) => {
    try {
      await api.closeAccount(budgetId, accountId);
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const sync = async (provider: SyncProvider) => {
    try {
      setSyncResult(await api.runSync(budgetId, provider.id));
      setError(null);
      await load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <section>
      {error && <div className="error">{error}</div>}

      {accounts?.length === 0 ? (
        <div className="empty">
          <svg className="empty-illustration" viewBox="0 0 120 120" aria-hidden="true">
            <path d="M25 50 H95" stroke-width="6" stroke-linecap="round"/>
            <path d="M25 70 H95" stroke-width="6" stroke-linecap="round"/>
            <path d="M45 50 V70" stroke-width="6" stroke-linecap="round"/>
            <path d="M65 30 V50" stroke-width="6" stroke-linecap="round"/>
            <path d="M75 30 V50" stroke-width="6" stroke-linecap="round"/>
            <path d="M60 70 V85" stroke-width="6" stroke-linecap="round"/>
            <path d="M55 85 H70" stroke-width="6" stroke-linecap="round"/>
          </svg>
          <p className="empty-title">No accounts yet</p>
          <p className="empty-description">Add starter accounts, or add your own below.</p>
          {canEdit && (
            <div className="empty-actions">
              <button
                className="btn btn-primary"
                onClick={addStarterAccounts}
                disabled={busy}
              >
                {busy ? 'Adding…' : 'Add starter accounts'}
              </button>
            </div>
          )}
        </div>
      ) : (
        ACCOUNT_GROUPS.map((group) => {
          const rows = (accounts ?? []).filter((account) =>
            group.types.includes(account.type),
          );
          if (rows.length === 0) return null;
          return (
            <div key={group.label}>
              <h2 className="section-title">{group.label}</h2>
              <table className="budget-grid">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Type</th>
                    <th className="right">Balance</th>
                    <th className="right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <button
                          className="btn-link"
                          onClick={() =>
                            navigate(`/budgets/${encodeURIComponent(budgetId)}/transactions?account=${encodeURIComponent(account.id)}`)
                          }
                        >
                          {account.name}
                        </button>
                      </td>
                      <td className="muted">{TYPE_LABELS[account.type]}</td>
                      <td className="right">
                        <span
                          className={
                            account.balanceMinor < 0
                              ? 'pill num negative'
                              : 'pill num positive'
                          }
                        >
                          {formatMoney(account.balanceMinor, currency)}
                        </span>
                      </td>
                      <td className="right">
                        {account.closed ? (
                          <span className="role-badge">closed</span>
                        ) : (
                          <button
                            className="btn-link danger"
                            onClick={() => close(account.id)}
                          >
                            Close
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      <form className="create-row" onSubmit={add}>
        <input
          className="input"
          placeholder="Account name, for example Checking"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="New account name"
        />
        <select
          className="select"
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
          aria-label="Account type"
        >
          {(Object.keys(TYPE_LABELS) as AccountType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" disabled={!name.trim()}>
          Add account
        </button>
      </form>

      {canEdit && (
        <>
          <h2 className="section-title">Mock bank sync</h2>
          <div className="create-row">
            {providers.map((provider) => (
              <button
                key={provider.id}
                className="btn btn-ghost"
                onClick={() => sync(provider)}
              >
                {provider.name}
              </button>
            ))}
          </div>
          {syncResult && (
            <p className="muted small">
              Imported {syncResult.imported}, ignored {syncResult.ignored},
              matched {syncResult.matched}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
