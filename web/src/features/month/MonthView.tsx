import { KeyboardEvent, useEffect, useState } from 'react';
import { MonthCategory, MonthView as MonthViewType, Role, api, errorMessage } from '../../lib/api';
import { currentMonth, formatMoney, parseMoney } from '../../lib/format';
import { isTypingTarget, useGlobalKey } from '../../lib/hooks';
import { Loading } from '../../lib/Loading';
import { readStored, writeStored } from '../../lib/storage';
import { starterGroups } from './starters';
import { MonthSwitcher } from './MonthPicker';
import { SetupGuide } from '../setup/SetupGuide';
import { FundEntry, MinimumMonth } from './MinimumMonth';
import { hasRole } from '../../lib/roles';
import { setupComplete } from './setup';
import { NameComposer, PlusIcon } from '../categories/NameComposer';
import { CategoryDraftRow } from '../categories/CategoryDraftRow';

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
  const guideDismissed = () => readStored(guideKey) === '1';
  const [guideOpen, setGuideOpen] = useState(false);
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<MonthViewType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Change[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [covering, setCovering] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [draftIn, setDraftIn] = useState<string | null>(null);
  const [previewMinor, setPreviewMinor] = useState(0);

  const allCategories = view?.groups.flatMap((g) => g.categories) ?? [];
  const draft = (minor: number) => (minor / 100).toFixed(2);

  useEffect(() => {
    // Ignore a response that lands after the person has moved to another month.
    let current = true;
    api
      .getMonth(budgetId, month)
      .then((next) => {
        if (!current) return;
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
      .catch((err) => current && setError(errorMessage(err)));
    return () => {
      current = false;
    };
  }, [budgetId, month]);

  // Any reload (starter set, setup guide, new category) can introduce categories
  // with no draft yet. Backfill them so the Assigned cell never renders blank.
  useEffect(() => {
    if (!view) return;
    setDrafts((current) => {
      const next = { ...current };
      let changed = false;
      for (const group of view.groups) {
        for (const category of group.categories) {
          if (!(category.id in next)) {
            next[category.id] = draft(category.allocatedMinor);
            changed = true;
          }
        }
      }
      return changed ? next : current;
    });
  }, [view]);

  // Auto-open the tutorial once per budget, but only while setup is unfinished.
  useEffect(() => {
    if (canEdit && view && !setupComplete(view) && !guideDismissed()) {
      setGuideOpen(true);
    }
  }, [view, budgetId, canEdit]);

  const closeGuide = () => {
    writeStored(guideKey, '1');
    setGuideOpen(false);
  };

  const commitAllocation = async (categoryId: string) => {
    const cat = allCategories.find((c) => c.id === categoryId);
    // Integer cents only: parseMoney never goes through floating point.
    const nextMinor = parseMoney(drafts[categoryId] ?? '');
    if (nextMinor === null) {
      if (cat) setDrafts((current) => ({ ...current, [categoryId]: draft(cat.allocatedMinor) }));
      setError('Enter an amount such as 250 or 250.50.');
      return;
    }
    if (cat && cat.allocatedMinor === nextMinor) {
      setDrafts((current) => ({ ...current, [categoryId]: draft(nextMinor) }));
      return;
    }
    try {
      setView(await api.setAllocations(budgetId, month, [{ categoryId, allocatedMinor: nextMinor }]));
      setDrafts((current) => ({ ...current, [categoryId]: draft(nextMinor) }));
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

  useGlobalKey((e) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !isTypingTarget(e.target)) {
      e.preventDefault();
      undo();
    }
  });

  // The composer shows failures inline, so these throw instead of setting `error`.
  const openDraft = (groupId: string) => {
    setCollapsed((c) => ({ ...c, [groupId]: false }));
    setDraftIn(groupId);
  };

  // A new group goes straight into adding its first category.
  const addGroup = async (name: string) => {
    const { group } = await api.createGroup(budgetId, name);
    setView(await api.getMonth(budgetId, month));
    openDraft(group.id);
  };

  const addCategory = async (groupId: string, name: string, assignMinor: number) => {
    const { category } = await api.createCategory(budgetId, groupId, name);
    let next: MonthViewType | null = null;
    if (assignMinor > 0) {
      try {
        next = await api.setAllocations(budgetId, month, [{ categoryId: category.id, allocatedMinor: assignMinor }]);
        setHistory((h) =>
          [{ categoryId: category.id, name, month, fromMinor: 0, toMinor: assignMinor, at: Date.now() }, ...h].slice(0, 50),
        );
        setDrafts((d) => ({ ...d, [category.id]: draft(assignMinor) }));
      } catch (err) {
        setError(`Added “${name}”, but could not assign money to it. ${errorMessage(err)}`);
      }
    }
    setView(next ?? (await api.getMonth(budgetId, month)));
    setJustAdded(category.id);
    window.setTimeout(() => setJustAdded((id) => (id === category.id ? null : id)), 2000);
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

  // Used by the setup guide: refresh the view and the Assigned inputs it may have changed.
  const reload = async () => {
    const next = await api.getMonth(budgetId, month);
    setView(next);
    setDrafts(
      Object.fromEntries(next.groups.flatMap((g) => g.categories.map((c) => [c.id, draft(c.allocatedMinor)]))),
    );
  };

  const enterCommits = (categoryId: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAllocation(categoryId);
    }
  };

  const pillClass = (minor: number) =>
    minor < 0 ? 'pill negative' : minor === 0 ? 'pill zero' : 'pill';
  const rtaMinor = (view?.readyToAssignMinor ?? 0) - previewMinor;
  const rtaClass = rtaMinor < 0 ? 'rta negative' : rtaMinor === 0 ? 'rta zero' : 'rta';

  return (
    <section>
      {error && <div className="error" role="alert">{error}</div>}

      <div className="month-header">
        <MonthSwitcher month={month} onChange={setMonth} />

        {canEdit && (
          <div className="history-bar">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setGuideOpen(true)}>
              Setup guide
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={undo} disabled={monthHistory.length === 0} title="Undo last change (Ctrl or Cmd + Z)" aria-keyshortcuts="Control+Z Meta+Z">
              ↶ Undo
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowHistory(!showHistory)} aria-expanded={showHistory}>
              History{monthHistory.length > 0 ? ` (${monthHistory.length})` : ''}
            </button>
          </div>
        )}

        {view && (
          <div className={rtaClass} role="status" aria-live="polite">
            <span className="rta-value">
              {formatMoney(rtaMinor, currency)}
            </span>
            <span className="rta-label">Ready to assign</span>
            <span className="rta-cue">
              {previewMinor > 0 && rtaMinor >= 0
                ? 'After the new category'
                : rtaMinor < 0
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
        <Loading label="Loading budget" />
      ) : (
        <>
          {canEdit && (
            <SetupGuide
              budgetId={budgetId}
              month={month}
              currency={currency}
              view={view}
              busy={busy}
              open={guideOpen}
              onStarter={addStarterCategories}
              onChanged={reload}
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
              <p className="empty-description">The guided setup explains each step as you go. Prefer to move fast? Start from a ready-made set.</p>
              {canEdit && (
                <div className="empty-actions">
                  <button type="button" className="btn btn-primary" onClick={() => setGuideOpen(true)}>
                    Start guided setup
                  </button>{' '}
                  <button
                    type="button"
                    className="btn"
                    onClick={addStarterCategories}
                    disabled={busy}
                  >
                    {busy ? 'Adding…' : 'Add starter categories'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="table-wrap">
            <table className="budget-grid month-grid">
              <caption className="visually-hidden">Category groups with assigned, activity and available amounts</caption>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className="right">Assigned</th>
                  <th scope="col" className="right">Activity</th>
                  <th scope="col" className="right">Available</th>
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
                            setCollapsed((c) => ({ ...c, [group.id]: !isCollapsed }))
                          }
                        >
                          <span className="chevron" aria-hidden="true" />
                          {group.name}
                        </button>
                        {canEdit && (
                          <button
                            className="group-add"
                            aria-label={`Add category to ${group.name}`}
                            title="Add category"
                            onClick={() => openDraft(group.id)}
                          >
                            <PlusIcon />
                          </button>
                        )}
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
                        <tr key={category.id} className={justAdded === category.id ? 'row-added' : undefined}>
                          <td>{category.name}</td>
                          <td className="right">
                            <input
                              className="input amount"
                              inputMode="decimal"
                              aria-label={`Assigned to ${category.name}`}
                              value={drafts[category.id] ?? ''}
                              autoComplete="off"
                              onChange={(e) =>
                                setDrafts((d) => ({ ...d, [category.id]: e.target.value }))
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
                              <div className="cover-pop">
                                <span className="muted">Move money from:</span>
                                {allCategories
                                  .filter((c) => c.id !== category.id && c.availableMinor > 0 && c.allocatedMinor > 0)
                                  .map((c) => (
                                    <button key={c.id} type="button" className="cover-option" onClick={() => cover(category, c.id)}>
                                      <span>{c.name}</span>
                                      <span className="num">{formatMoney(Math.min(c.availableMinor, c.allocatedMinor), currency)}</span>
                                    </button>
                                  ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    {!isCollapsed && canEdit && draftIn === group.id && (
                      <CategoryDraftRow
                        groupName={group.name}
                        existing={group.categories.map((c) => c.name)}
                        budgetNames={allCategories.map((c) => c.name)}
                        currency={currency}
                        onAdd={(name, assignMinor) => addCategory(group.id, name, assignMinor)}
                        onPreview={setPreviewMinor}
                        onClose={() => setDraftIn(null)}
                      />
                    )}
                    {!isCollapsed && canEdit && draftIn !== group.id && (
                      <tr className="add-category-row">
                        <td colSpan={4}>
                          <button type="button" className="composer-trigger row" onClick={() => openDraft(group.id)}>
                            <PlusIcon />
                            Add category
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </table>
            </div>
          )}

          {canEdit && (
            <div className="add-group">
              <NameComposer
                key={view.groups.length === 0 ? 'first-group' : 'more-groups'}
                kind="group"
                variant="block"
                triggerLabel="Add category group"
                placeholder="Group name, for example Fixed costs"
                ariaLabel="New category group"
                existing={view.groups.map((g) => g.name)}
                onAdd={addGroup}
                closeOnAdd
                defaultOpen={view.groups.length === 0}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
