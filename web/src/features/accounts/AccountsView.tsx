import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Account,
  AccountType,
  Role,
  SyncProvider,
  SyncResult,
  api,
  errorMessage,
} from '../../lib/api';
import { ACCOUNT_GROUPS } from '../budgets/BudgetSidebar';
import { formatMoney } from '../../lib/format';
import { TYPES, TYPE_LABEL, parseBalance, todayIso } from './shared';
import { Link } from '../../app/Link';
import { Loading } from '../../lib/Loading';
import { Menu, DotsIcon } from '../../lib/Menu';
import { Modal, useConfirm } from '../../lib/Modal';
import { hasRole } from '../../lib/roles';
import { PlusIcon } from '../categories/NameComposer';

const POPULAR_BANKS = [
  'Chase', 'Capital One', 'American Express', 'Bank of America', 'Citi',
  'Discover', 'Wells Fargo', 'Ally', 'USAA', 'Apple',
];


const BankArt = () => (
  <svg className="acct-art" viewBox="0 0 200 170" aria-hidden="true">
    <path className="art-blob" d="M30 80C24 40 70 8 110 14c40 6 74 34 70 76-4 44-44 70-88 66-34-3-56-30-62-76z" />
    <g className="art-bank" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
      <path d="M100 38 160 68H40z" />
      <path d="M44 74H156V82H44z" />
      <path d="M58 90V132M84 90V132M116 90V132M142 90V132" />
      <path d="M40 140H160V150H40z" />
    </g>
  </svg>
);

const SyncIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 6A5.5 5.5 0 0 0 3.6 4.4M2.5 10a5.5 5.5 0 0 0 9.9 1.6M3 2v3h3M13 14v-3h-3" />
  </svg>
);

/** Credit balances are normally negative, so "owed" reads neutral; only overdrawn cash is red. */
function Balance({ account, currency }: { account: Account; currency: string }) {
  const { balanceMinor: b, type } = account;
  if (type === 'credit') {
    if (b === 0) return <span className="bal num muted">{formatMoney(0, currency)}</span>;
    return (
      <span className="bal num">
        {formatMoney(Math.abs(b), currency)}
        <small className="bal-note">{b < 0 ? 'owed' : 'credit'}</small>
      </span>
    );
  }
  return (
    <span className={`bal num${b < 0 ? ' negative' : ''}`}>
      {formatMoney(b, currency)}
      {b < 0 && <small className="bal-note">overdrawn</small>}
    </span>
  );
}

export function AccountsView({
  budgetId,
  currency,
  role,
}: {
  budgetId: string;
  currency: string;
  role: Role;
}) {
  const canEdit = hasRole(role, 'editor');

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [providers, setProviders] = useState<SyncProvider[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const load = () =>
    api
      .listAccounts(budgetId)
      .then(({ accounts }) => {
        setAccounts(accounts);
        setError(null);
      })
      .catch((err) => setError(errorMessage(err)));

  useEffect(() => {
    setAccounts(null);
    load();
  }, [budgetId]);

  useEffect(() => {
    if (!canEdit) return;
    api
      .listSyncProviders(budgetId)
      .then(({ providers }) => setProviders(providers))
      .catch((err) => setError(errorMessage(err)));
  }, [budgetId, canEdit]);

  const open = useMemo(() => (accounts ?? []).filter((a) => !a.closed), [accounts]);
  const closed = useMemo(() => (accounts ?? []).filter((a) => a.closed), [accounts]);
  const net = open.reduce((sum, a) => sum + a.balanceMinor, 0);

  const close = async (account: Account) => {
    const hasBalance = account.balanceMinor !== 0;
    const ok = await confirm({
      title: `Close ${account.name}?`,
      message: hasBalance
        ? `It still has a balance of ${formatMoney(account.balanceMinor, currency)}. Closed accounts move out of your list, and you can still find them under "Closed".`
        : 'Closed accounts move out of your list, and you can still find them under "Closed".',
      confirmLabel: 'Close account',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.closeAccount(budgetId, account.id);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const sync = async (provider: SyncProvider) => {
    setSyncing(provider.name);
    setSyncResult(null);
    try {
      setSyncResult(await api.runSync(budgetId, provider.id));
      setError(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSyncing(null);
    }
  };

  const syncControl =
    canEdit && providers.length > 0 ? (
      providers.length === 1 ? (
        <button className="btn" disabled={!!syncing} onClick={() => sync(providers[0])}>
          <SyncIcon /> {syncing ? 'Syncing…' : `Sync ${providers[0].name}`}
        </button>
      ) : (
        <Menu
          label="Sync a bank"
          trigger={
            <>
              <SyncIcon /> {syncing ? 'Syncing…' : 'Sync'}
            </>
          }
        >
          {(done) =>
            providers.map((p) => (
              <button
                key={p.id}
                role="menuitem"
                className="menu-item"
                disabled={!!syncing}
                onClick={() => {
                  done();
                  void sync(p);
                }}
              >
                {p.name}
              </button>
            ))
          }
        </Menu>
      )
    ) : null;

  const row = (account: Account) => (
    <li key={account.id} className={`acct-row${account.closed ? ' is-closed' : ''}`}>
      <Link
        className="acct-link"
        to={`/budgets/${encodeURIComponent(budgetId)}/transactions?account=${encodeURIComponent(account.id)}`}
      >
        <span className="acct-name">{account.name}</span>
        <span className="acct-meta">
          {TYPE_LABEL[account.type]}
          {account.provider && <span className="acct-badge">Synced</span>}
        </span>
      </Link>
      <Balance account={account} currency={currency} />
      {canEdit && !account.closed ? (
        <Menu label={`Actions for ${account.name}`} trigger={<DotsIcon />}>
          {(done) => (
            <button
              role="menuitem"
              className="menu-item danger"
              onClick={() => {
                done();
                void close(account);
              }}
            >
              Close account
            </button>
          )}
        </Menu>
      ) : (
        <span className="acct-spacer" aria-hidden="true" />
      )}
    </li>
  );

  return (
    <section className="accounts">
      {error && <div className="error" role="alert">{error}</div>}

      <header className="acct-header">
        <div>
          <h2 className="acct-title">Accounts</h2>
          {open.length > 0 && (
            <p className="acct-sub num">
              <strong>{formatMoney(net, currency)}</strong> net across {open.length}{' '}
              {open.length === 1 ? 'account' : 'accounts'}
            </p>
          )}
        </div>
        {accounts && accounts.length > 0 && (
          <div className="acct-actions">
            {syncControl}
            {canEdit && (
              <button className="btn btn-primary" onClick={() => setAdding(true)}>
                <PlusIcon /> Add account
              </button>
            )}
          </div>
        )}
      </header>

      {syncResult && (
        <div className="acct-status" role="status">
          <span>
            Sync finished: {syncResult.imported} new, {syncResult.matched} matched,{' '}
            {syncResult.ignored} ignored.
          </span>
          <button className="btn-link" onClick={() => setSyncResult(null)} aria-label="Dismiss sync result">
            Dismiss
          </button>
        </div>
      )}

      {accounts === null ? (
        <Loading label="Loading accounts" />
      ) : accounts.length === 0 ? (
        <div className="acct-empty">
          <BankArt />
          <p className="acct-empty-text">
            {canEdit ? 'To start planning, add an account!' : 'Ask an editor to add an account.'}
          </p>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              Add account
            </button>
          )}
        </div>
      ) : (
        <>
          {ACCOUNT_GROUPS.map((group) => {
            const rows = open.filter((a) => group.types.includes(a.type));
            if (rows.length === 0) return null;
            const total = rows.reduce((s, a) => s + a.balanceMinor, 0);
            const isCredit = group.types.includes('credit');
            return (
              <div key={group.label} className="acct-group">
                <div className="acct-group-head">
                  <h3>{group.label}</h3>
                  <span className="num muted">
                    {isCredit
                      ? total < 0
                        ? `${formatMoney(Math.abs(total), currency)} owed`
                        : formatMoney(total, currency)
                      : formatMoney(total, currency)}
                  </span>
                </div>
                <ul className="acct-list" aria-label={group.label}>
                  {rows.map(row)}
                </ul>
              </div>
            );
          })}

          {open.length === 0 && (
            <p className="muted">All accounts are closed. Add a new one to keep budgeting.</p>
          )}

          {closed.length > 0 && (
            <div className="acct-group">
              <button
                className="acct-toggle"
                aria-expanded={showClosed}
                onClick={() => setShowClosed((s) => !s)}
              >
                <span aria-hidden="true">{showClosed ? '▾' : '▸'}</span> Closed ({closed.length})
              </button>
              {showClosed && <ul className="acct-list" aria-label="Closed accounts">{closed.map(row)}</ul>}
            </div>
          )}
        </>
      )}

      {adding && (
        <AddAccountModal
          existing={(accounts ?? []).map((a) => a.name)}
          onClose={() => setAdding(false)}
          onAdd={async (name, type, balanceMinor) => {
            const { account } = await api.createAccount(budgetId, name, type);
            setAdding(false);
            await load();
            if (balanceMinor !== 0) {
              try {
                await api.createTransaction(budgetId, {
                  accountId: account.id,
                  payee: 'Starting Balance',
                  amountMinor: balanceMinor,
                  date: todayIso(),
                });
                await load();
              } catch (err) {
                setError(`${name} was added, but its starting balance wasn't saved: ${errorMessage(err)}`);
              }
            }
          }}
        />
      )}
      {confirmDialog}
    </section>
  );
}

function AddAccountModal({
  existing,
  onAdd,
  onClose,
}: {
  existing: string[];
  onAdd: (name: string, type: AccountType, balanceMinor: number) => Promise<void>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'pick' | 'unlinked'>('pick');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();
  const duplicate = existing.some((n) => n.toLowerCase() === trimmed.toLowerCase());
  const parsed = parseBalance(balance);
  const isCredit = type === 'credit';
  const balanceMinor = parsed === null ? null : isCredit ? -Math.abs(parsed) : parsed;
  const matches = POPULAR_BANKS.filter((b) => b.toLowerCase().includes(search.trim().toLowerCase()));

  const goUnlinked = (prefill?: string) => {
    if (prefill) {
      setName(prefill);
      setNote(`Linking ${prefill} isn't available yet. Add it as an unlinked account for now.`);
    }
    setStep('unlinked');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || duplicate || balanceMinor === null || saving) return;
    setSaving(true);
    try {
      await onAdd(trimmed, type, balanceMinor);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  };

  if (step === 'pick') {
    return (
      <Modal title="Add account" size="md" onClose={onClose}>
        <div className="field">
          <label htmlFor="bank-search">Search for your bank</label>
          <input
            id="bank-search"
            className="input"
            data-autofocus
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {matches.length > 0 ? (
          <>
            <p className="pick-label">Popular options</p>
            <ul className="bank-grid">
              {matches.map((bank) => (
                <li key={bank}>
                  <button type="button" className="bank-tile" onClick={() => goUnlinked(bank)}>
                    {bank}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted small">
            No match. Bank linking isn't available yet, but you can add it as an unlinked account.
          </p>
        )}
        <div className="or-divider"><span>or</span></div>
        <button type="button" className="btn btn-soft btn-block" onClick={() => goUnlinked(search.trim() && matches.length === 0 ? search.trim() : undefined)}>
          Add an unlinked account
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Add unlinked account" size="md" onClose={onClose}>
      <form onSubmit={submit}>
        <button type="button" className="btn-link back-link" onClick={() => setStep('pick')}>
          ‹ Back
        </button>
        <p className="muted unlinked-intro">
          {note ?? "No bank connection needed. You'll enter transactions yourself."}
        </p>
        <fieldset className="type-picker">
          <legend className="visually-hidden">Account type</legend>
          {TYPES.map((t) => (
            <label key={t.id} className={`type-option${type === t.id ? ' selected' : ''}`}>
              <input
                type="radio"
                name="account-type"
                className="visually-hidden"
                checked={type === t.id}
                onChange={() => setType(t.id)}
              />
              <strong>{t.label}</strong>
              <span>{t.hint}</span>
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor="account-name">Give it a nickname</label>
          <input
            id="account-name"
            className={`input${duplicate ? ' invalid' : ''}`}
            autoFocus
            autoComplete="off"
            placeholder={isCredit ? 'e.g. Visa' : 'e.g. Everyday checking'}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            aria-invalid={duplicate}
            aria-describedby="account-name-hint"
          />
          <p id="account-name-hint" className={`field-hint small ${duplicate || error ? 'negative' : 'muted'}`}>
            {duplicate ? 'You already have an account with this name.' : error ?? ''}
          </p>
        </div>
        <div className="field">
          <label htmlFor="account-balance">
            {isCredit ? 'How much do you owe right now?' : 'What is the current balance?'}
          </label>
          <input
            id="account-balance"
            className={`input${balanceMinor === null ? ' invalid' : ''}`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            aria-invalid={balanceMinor === null}
          />
          <p className="field-hint small muted">
            {balanceMinor === null
              ? 'Enter an amount like 1,250.00.'
              : isCredit
                ? 'Leave blank if the card is paid off.'
                : 'Leave blank to start at $0. Use a minus sign if overdrawn.'}
          </p>
        </div>
        <button className="btn btn-primary btn-block" disabled={!trimmed || duplicate || balanceMinor === null || saving}>
          {saving ? 'Adding…' : 'Add account'}
        </button>
      </form>
    </Modal>
  );
}
