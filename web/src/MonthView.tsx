import { FormEvent, useEffect, useState } from 'react';
import { MonthCategory, MonthView as MonthViewType, Role, api, errorMessage } from './api';
import { currentMonth, formatMoney } from './format';
import { starterGroups } from './starters';
import { MonthSwitcher } from './MonthPicker';
import { GuidedSetup } from './GuidedSetup';
import { FundEntry, MinimumMonth } from './MinimumMonth';
import { hasRole } from './roles';
import { setupComplete } from './setup';

type Change = {
  categoryId: string;
  name: string;
  month: string;
  fromMinor: number;
  toMinor: number;
  at: number;
};

export function MonthView({
  budgetId,
  currency,
  role,
}: {
  budgetId: string;
  currency: string;
  role?: Role;
}) {
  const canEdit = role !== undefined && hasRole(role, 'editor');
  const guideKey = `onebudget:guide-dismissed:${budgetId}`;
  const guideDismissed = () => localStorage.getItem(guideKey) === '1';
  const [guideOpen, setGuideOpen] = useState(false);
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<MonthViewType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newGroup, setNewGroup] = useState('');
  const [newCategory, setNewCategory] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Change[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [covering, setCovering] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const allCategories = view?.groups.flatMap((g) => g.categories) ?? [];
  const draft = (minor: number) => (minor / 100).toFixed(2);

  useEffect(() => {
    api
      .getMonth(budgetId, month)
      .then((next) => {
        setView(next);
        setError(null);
        const values: Record<string, string> = {};
        for (const group of next.groups) {
          for (const category of group.categories) {
            values[category.id] = draft(category.allocatedMinor);
          }
        }
        setDrafts(values);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [budgetId, month]);

  // Auto-open the tutorial once per budget, but only while setup is unfinished.
  useEffect(() => {
    if (canEdit && view && !setupComplete(view) && !guideDismissed()) {
      setGuideOpen(true);
    }
  }, [view, budgetId, canEdit]);

  const closeGuide = () => {
    localStorage.setItem(guideKey, '1');
    setGuideOpen(false);
  };

  const commitAllocation = async (categoryId: string) => {
    const dollars = Number(drafts[categoryId] ?? 0);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    const nextMinor = Math.round(dollars * 100);
    const cat = allCategories.find((c) => c.id === categoryId);
    if (cat && cat.allocatedMinor === nextMinor) {
      setDrafts((current) => ({ ...current, [categoryId]: dollars.toFixed(2) }));
      return;
    }
    try {
      setView(await api.setAllocations(budgetId, month, [{ categoryId, allocatedMinor: nextMinor }]));
      setDrafts((current) => ({ ...current, [categoryId]: dollars.toFixed(2) }));
      if (cat) {
        setHistory((h) =>
          [{ categoryId, name: cat.name, month, fromMinor: cat.allocatedMinor, toMinor: nextMinor, at: Date.now() }, ...h].slice(0, 50),
        );
      }
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const cover = async (target: MonthCategory, sourceId: string) => {
    const src = allCategories.find((c) => c.id === sourceId);
    if (!src) return;
    const amt = Math.min(-target.availableMinor, src.availableMinor, src.allocatedMinor);
    if (amt <= 0) return;
    try {
      setView(
        await api.setAllocations(budgetId, month, [
          { categoryId: src.id, allocatedMinor: src.allocatedMinor - amt },
          { categoryId: target.id, allocatedMinor: target.allocatedMinor + amt },
        ]),
      );
      setDrafts((d) => ({
        ...d,
        [src.id]: draft(src.allocatedMinor - amt),
        [target.id]: draft(target.allocatedMinor + amt),
      }));
      const at = Date.now();
      setHistory((h) => [
        { categoryId: target.id, name: target.name, month, fromMinor: target.allocatedMinor, toMinor: target.allocatedMinor + amt, at: at + 1 },
        { categoryId: src.id, name: src.name, month, fromMinor: src.allocatedMinor, toMinor: src.allocatedMinor - amt, at },
        ...h,
      ].slice(0, 50));
      setCovering(null);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const availableHint = (minor: number) =>
    minor < 0
      ? 'Overspent. Unless you cover it, this reduces next month\'s Ready to assign.'
      : minor === 0
        ? 'Fully spent. Nothing left in this category.'
        : 'Money left in this category. It carries over to next month.';

  const fund = async (entries: FundEntry[]) => {
    try {
      setView(
        await api.setAllocations(
          budgetId,
          month,
          entries.map((e) => ({ categoryId: e.category.id, allocatedMinor: e.nextMinor })),
        ),
      );
      setDrafts((d) => {
        const next = { ...d };
        entries.forEach((e) => (next[e.category.id] = draft(e.nextMinor)));
        return next;
      });
      const at = Date.now();
      setHistory((h) =>
        [
          ...entries.map((e, i) => ({
            categoryId: e.category.id,
            name: e.category.name,
            month,
            fromMinor: e.category.allocatedMinor,
            toMinor: e.nextMinor,
            at: at + entries.length - i,
          })),
          ...h,
        ].slice(0, 50),
      );
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const monthHistory = history.filter((h) => h.month === month);
  const undo = async () => {
    const last = monthHistory[0];
    if (!last) return;
    try {
      setView(
        await api.setAllocations(budgetId, last.month, [
          { categoryId: last.categoryId, allocatedMinor: last.fromMinor },
        ]),
      );
      setDrafts((d) => ({ ...d, [last.categoryId]: draft(last.fromMinor) }));
      setHistory((h) => h.filter((x) => x !== last));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && tag !== 'INPUT' && tag !== 'SELECT') {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const addGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGroup.trim()) return;
    try {
      await api.createGroup(budgetId, newGroup.trim());
      setNewGroup('');
      setView(await api.getMonth(budgetId, month));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const addCategory = async (e: FormEvent, groupId: string) => {
    e.preventDefault();
    const name = newCategory[groupId]?.trim();
    if (!name) return;
    try {
      await api.createCategory(budgetId, groupId, name);
      setNewCategory({ ...newCategory, [groupId]: '' });
      setView(await api.getMonth(budgetId, month));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const addStarterCategories = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      for (const group of starterGroups) {
        const { group: created } = await api.createGroup(budgetId, group.name);
        for (const name of group.categories) {
          await api.createCategory(budgetId, created.id, name);
        }
      }
      setView(await api.getMonth(budgetId, month));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => setView(await api.getMonth(budgetId, month));

  const enterCommits = (categoryId: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAllocation(categoryId);
    }
  };

  const pillClass = (minor: number) =>
    minor < 0 ? 'pill negative' : minor === 0 ? 'pill zero' : 'pill';
  const rtaMinor = view?.readyToAssignMinor ?? 0;
  const rtaClass = rtaMinor < 0 ? 'rta negative' : rtaMinor === 0 ? 'rta zero' : 'rta';

  return (
    <section>
      {error && <div className="error">{error}</div>}

      <div className="month-header">
        <MonthSwitcher month={month} onChange={setMonth} />

        {canEdit && (
          <div className="history-bar">
            <button className="btn btn-ghost btn-sm" onClick={() => setGuideOpen(true)}>
              Setup guide
            </button>
            <button className="btn btn-ghost btn-sm" onClick={undo} disabled={monthHistory.length === 0} title="Undo last change (Ctrl or Cmd + Z)">
              ↶ Undo
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>
              History{monthHistory.length > 0 ? ` (${monthHistory.length})` : ''}
            </button>
          </div>
        )}

        {view && (
          <div className={rtaClass}>
            <span className="rta-value">
              {formatMoney(view.readyToAssignMinor, currency)}
            </span>
            <span className="rta-label">Ready to assign</span>
            <span className="rta-cue">
              {rtaMinor < 0
                ? `Over-assigned. Lower Assigned by ${formatMoney(-rtaMinor, currency)}`
                : rtaMinor === 0
                  ? 'Every dollar has a job'
                  : 'Give this money a job'}
            </span>
          </div>
        )}
      </div>

      {showHistory && (
        <div className="history-panel" role="region" aria-label="Assignment history">
          {monthHistory.length === 0 ? (
            <p className="muted">No changes yet this session. Edits you make to Assigned amounts appear here.</p>
          ) : (
            <ul>
              {monthHistory.slice(0, 8).map((h) => (
                <li key={h.at}>
                  <strong>{h.name}</strong>
                  <span className="num">{formatMoney(h.fromMinor, currency)} → {formatMoney(h.toMinor, currency)}</span>
                  <span className="muted">{new Date(h.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {canEdit && (
            <GuidedSetup
              budgetId={budgetId}
              month={month}
              currency={currency}
              view={view}
              busy={busy}
              open={guideOpen}
              onStarter={addStarterCategories}
              onChanged={() => reload().catch((err) => setError(errorMessage(err)))}
              onClose={closeGuide}
            />
          )}
          {canEdit && view.groups.length > 0 && (
            <MinimumMonth budgetId={budgetId} month={month} currency={currency} view={view} onFund={fund} />
          )}
          {view.groups.length === 0 ? (
            <div className="empty">
              <svg className="empty-illustration" viewBox="0 0 120 120" aria-hidden="true">
                <path d="M30 85 L30 45 C30 36.7 36.7 30 45 30 H75 C83.3 30 90 36.7 90 45 V85" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M60 55 V85" strokeWidth="6" strokeLinecap="round"/>
                <path d="M45 70 H75" strokeWidth="6" strokeLinecap="round"/>
              </svg>
              <p className="empty-title">No categories yet</p>
              <p className="empty-description">Start by adding a category group, or use a starter set.</p>
              {canEdit && (
                <div className="empty-actions">
                  <button
                    className="btn btn-primary"
                    onClick={addStarterCategories}
                    disabled={busy}
                  >
                    {busy ? 'Adding…' : 'Add starter categories'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <table className="budget-grid month-grid">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="right">Assigned</th>
                  <th className="right">Activity</th>
                  <th className="right">Available</th>
                </tr>
              </thead>
              {view.groups.map((group) => {
                const sum = (pick: (c: (typeof group.categories)[number]) => number) =>
                  group.categories.reduce((total, c) => total + pick(c), 0);
                const isCollapsed = collapsed[group.id] === true;
                return (
                  <tbody key={group.id}>
                    <tr className="group-row">
                      <td>
                        <button
                          className="group-toggle"
                          aria-expanded={!isCollapsed}
                          onClick={() =>
                            setCollapsed({ ...collapsed, [group.id]: !isCollapsed })
                          }
                        >
                          <span className="chevron" aria-hidden="true" />
                          {group.name}
                        </button>
                      </td>
                      <td className="right group-total num">
                        {formatMoney(sum((c) => c.allocatedMinor), currency)}
                      </td>
                      <td className="right group-total num">
                        {formatMoney(sum((c) => c.activityMinor), currency)}
                      </td>
                      <td className="right group-total num">
                        {formatMoney(sum((c) => c.availableMinor), currency)}
                      </td>
                    </tr>
                    {!isCollapsed &&
                      group.categories.map((category) => (
                        <tr key={category.id}>
                          <td>{category.name}</td>
                          <td className="right">
                            <input
                              className="input amount"
                              inputMode="decimal"
                              aria-label={`Assigned to ${category.name}`}
                              value={drafts[category.id] ?? ''}
                              onChange={(e) =>
                                setDrafts({
                                  ...drafts,
                                  [category.id]: e.target.value,
                                })
                              }
                              onBlur={() => commitAllocation(category.id)}
                              onKeyDown={enterCommits(category.id)}
                            />
                          </td>
                          <td className="right num muted">
                            {formatMoney(category.activityMinor, currency)}
                          </td>
                          <td className="right">
                            <span className={pillClass(category.availableMinor)} title={availableHint(category.availableMinor)}>
                              {formatMoney(category.availableMinor, currency)}
                            </span>
                            {category.availableMinor < 0 && (
                              <div className="cue">
                                Overspent.{' '}
                                {canEdit ? (
                                  <button
                                    className="btn-link"
                                    aria-expanded={covering === category.id}
                                    onClick={() => setCovering(covering === category.id ? null : category.id)}
                                  >
                                    Cover it
                                  </button>
                                ) : (
                                  'Needs covering.'
                                )}
                              </div>
                            )}
                            {covering === category.id && (
                              <div className="cover-pop" role="menu">
                                <span className="muted">Move money from:</span>
                                {allCategories
                                  .filter((c) => c.id !== category.id && c.availableMinor > 0 && c.allocatedMinor > 0)
                                  .map((c) => (
                                    <button key={c.id} role="menuitem" className="cover-option" onClick={() => cover(category, c.id)}>
                                      <span>{c.name}</span>
                                      <span className="num">{formatMoney(Math.min(c.availableMinor, c.allocatedMinor), currency)}</span>
                                    </button>
                                  ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    {!isCollapsed && (
                      <tr className="add-category-row">
                        <td colSpan={4}>
                          <form
                            className="create-row compact"
                            onSubmit={(e) => addCategory(e, group.id)}
                          >
                            <input
                              className="input"
                              placeholder="+ New category"
                              value={newCategory[group.id] ?? ''}
                              onChange={(e) =>
                                setNewCategory({
                                  ...newCategory,
                                  [group.id]: e.target.value,
                                })
                              }
                              aria-label={`New category in ${group.name}`}
                            />
                            <button className="btn btn-ghost btn-sm">Add</button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </table>
          )}

          <form className="create-row" onSubmit={addGroup}>
            <input
              className="input"
              placeholder="New category group, for example Fixed costs"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              aria-label="New category group"
            />
            <button className="btn btn-primary" disabled={!newGroup.trim()}>
              Add group
            </button>
          </form>
        </>
      )}
    </section>
  );
}
