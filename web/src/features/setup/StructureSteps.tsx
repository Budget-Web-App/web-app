import { FormEvent, useEffect, useRef, useState } from 'react';
import { Account, AccountType, MonthView, api } from '../../lib/api';
import { validateName } from '../categories/categoryName';
import { suggestCategoryNames } from '../categories/suggestions';
import { starterAccounts } from '../month/starters';
import { TYPE_LABEL } from '../accounts/shared';
import { GROUP_IDEAS, LESSONS } from './content';
import { accountNameProblem } from './guide';
import { Callout, Ideas, Problem, useAction } from './parts';

export function WelcomeStep() {
  const nodes = [
    ['Money you have', 'Balances and paychecks'],
    ['Ready to assign', 'Money with no job yet'],
    ['Categories', 'Rent, groceries, savings'],
    ['Spending', 'Comes out of a category'],
  ];
  return (
    <>
      <ol className="guide-flow" aria-label="How money moves through the budget">
        {nodes.map(([title, sub]) => (
          <li key={title}>
            <strong>{title}</strong>
            <span className="muted small">{sub}</span>
          </li>
        ))}
      </ol>
      <p className="guide-note">
        This takes about five minutes. Everything you enter is real and lands in your budget, so
        you can stop any time and pick up later.
      </p>
    </>
  );
}

export function GroupsStep({
  budgetId,
  view,
  busy,
  onStarter,
  onChanged,
}: {
  budgetId: string;
  view: MonthView;
  busy: boolean;
  onStarter: () => void;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const { pending, problem, setProblem, run } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const existing = view.groups.map((g) => g.name);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const issue = validateName(name, existing, 'group');
    if (issue) return setProblem(issue);
    const ok = await run(async () => {
      await api.createGroup(budgetId, name.trim());
      await onChanged();
    });
    if (ok) setName('');
    input.current?.focus();
  };

  const ideas = GROUP_IDEAS.filter((g) => !existing.some((e) => e.toLowerCase() === g.toLowerCase()));

  return (
    <>
      <form className="guide-form" onSubmit={submit} noValidate>
        <input
          ref={input}
          className={`input${problem ? ' invalid' : ''}`}
          placeholder="Group name, for example Bills"
          aria-label="Group name"
          value={name}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value);
            setProblem(null);
          }}
        />
        <button className="btn btn-primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add group'}
        </button>
      </form>
      {problem && <Problem>{problem}</Problem>}
      <Ideas label="Ideas" ideas={ideas} onPick={setName} />

      {view.groups.length > 0 && (
        <ul className="guide-built" aria-label="Your groups">
          {view.groups.map((g) => (
            <li key={g.id}>{g.name}</li>
          ))}
        </ul>
      )}
      {view.groups.length === 0 && (
        <p className="guide-alt">
          In a hurry?{' '}
          <button type="button" className="btn-link" onClick={onStarter} disabled={busy}>
            {busy ? 'Adding…' : 'Add a ready-made starter set'}
          </button>{' '}
          with groups and categories you can rename later.
        </p>
      )}
    </>
  );
}

export function CategoriesStep({
  budgetId,
  view,
  onChanged,
}: {
  budgetId: string;
  view: MonthView;
  onChanged: () => Promise<void>;
}) {
  const [groupId, setGroupId] = useState(view.groups[0]?.id ?? '');
  const [name, setName] = useState('');
  const { pending, problem, setProblem, run } = useAction();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!view.groups.some((g) => g.id === groupId)) setGroupId(view.groups[0]?.id ?? '');
  }, [view, groupId]);

  if (view.groups.length === 0) {
    return <Callout>Categories live inside a group. Go back one step and create your first group.</Callout>;
  }

  const group = view.groups.find((g) => g.id === groupId) ?? view.groups[0];
  const allNames = view.groups.flatMap((g) => g.categories.map((c) => c.name));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const issue = validateName(name, group.categories.map((c) => c.name), 'category');
    if (issue) return setProblem(issue);
    const ok = await run(async () => {
      await api.createCategory(budgetId, group.id, name.trim());
      await onChanged();
    });
    if (ok) setName('');
    input.current?.focus();
  };

  return (
    <>
      <form className="guide-form guide-form-wrap" onSubmit={submit} noValidate>
        <select
          className="select"
          aria-label="Group for the new category"
          value={group.id}
          onChange={(e) => setGroupId(e.target.value)}
        >
          {view.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <input
          ref={input}
          className={`input${problem ? ' invalid' : ''}`}
          placeholder="Category name, for example Groceries"
          aria-label="Category name"
          value={name}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value);
            setProblem(null);
          }}
        />
        <button className="btn btn-primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add category'}
        </button>
      </form>
      {problem && <Problem>{problem}</Problem>}
      <Ideas label="Ideas" ideas={suggestCategoryNames(name, allNames, 5)} onPick={setName} />

      <div className="guide-examples">
        <div>
          <span className="guide-tag guide-tag-good">Clear</span> {LESSONS.categories.good?.join(', ')}
        </div>
        <div>
          <span className="guide-tag guide-tag-bad">Vague</span> {LESSONS.categories.bad?.join(', ')}
        </div>
      </div>

      {view.groups.some((g) => g.categories.length > 0) && (
        <dl className="guide-built-groups">
          {view.groups.map((g) => (
            <div key={g.id}>
              <dt>{g.name}</dt>
              <dd>{g.categories.length === 0 ? <span className="muted">No categories yet</span> : g.categories.map((c) => c.name).join(', ')}</dd>
            </div>
          ))}
        </dl>
      )}
    </>
  );
}

export function AccountsStep({
  budgetId,
  accounts,
  onAccountsChanged,
}: {
  budgetId: string;
  accounts: Account[];
  onAccountsChanged: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const { pending, problem, setProblem, run } = useAction();
  const input = useRef<HTMLInputElement>(null);
  const existing = accounts.map((a) => a.name);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const issue = accountNameProblem(name, existing);
    if (issue) return setProblem(issue);
    const ok = await run(async () => {
      await api.createAccount(budgetId, name.trim(), type);
      await onAccountsChanged();
    });
    if (ok) setName('');
    input.current?.focus();
  };

  const addStarters = () =>
    run(async () => {
      for (const starter of starterAccounts) {
        if (!existing.some((n) => n.toLowerCase() === starter.name.toLowerCase())) {
          await api.createAccount(budgetId, starter.name, starter.type);
        }
      }
      await onAccountsChanged();
    });

  const ideas = starterAccounts.filter((s) => !existing.some((n) => n.toLowerCase() === s.name.toLowerCase()));

  return (
    <>
      <form className="guide-form guide-form-wrap" onSubmit={submit} noValidate>
        <input
          ref={input}
          className={`input${problem ? ' invalid' : ''}`}
          placeholder="Account name, for example Checking"
          aria-label="Account name"
          value={name}
          autoComplete="off"
          onChange={(e) => {
            setName(e.target.value);
            setProblem(null);
          }}
        />
        <select
          className="select"
          aria-label="Account type"
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
        >
          {(Object.keys(TYPE_LABEL) as AccountType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add account'}
        </button>
      </form>
      {problem && <Problem>{problem}</Problem>}
      <Ideas
        label="Ideas"
        ideas={ideas.map((s) => s.name)}
        onPick={(picked) => {
          setName(picked);
          setType(starterAccounts.find((s) => s.name === picked)?.type ?? 'checking');
        }}
      />

      {accounts.length > 0 ? (
        <ul className="guide-built" aria-label="Your accounts">
          {accounts.map((a) => (
            <li key={a.id}>
              {a.name} <span className="muted small">{TYPE_LABEL[a.type]}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="guide-alt">
          In a hurry?{' '}
          <button type="button" className="btn-link" onClick={addStarters} disabled={pending}>
            Add checking, savings and a credit card
          </button>{' '}
          and rename them later.
        </p>
      )}
    </>
  );
}
