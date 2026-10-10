import { FormEvent, useEffect, useState } from 'react';
import { MonthView as MonthViewType, Role, api, errorMessage } from './api';
import { currentMonth, formatMoney, monthLabel, shiftMonth, monthOptions } from './format';
import { starterGroups } from './starters';

const RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

export function MonthView({
  budgetId,
  currency,
  role,
}: {
  budgetId: string;
  currency: string;
  role?: Role;
}) {
  const canEdit = role !== undefined && RANK[role] >= RANK.editor;
  const [month, setMonth] = useState(currentMonth());
  const [view, setView] = useState<MonthViewType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newGroup, setNewGroup] = useState('');
  const [newCategory, setNewCategory] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getMonth(budgetId, month)
      .then((next) => {
        setView(next);
        setError(null);
        const values: Record<string, string> = {};
        for (const group of next.groups) {
          for (const category of group.categories) {
            values[category.id] = String(category.allocatedMinor / 100);
          }
        }
        setDrafts(values);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [budgetId, month]);

  const commitAllocation = async (categoryId: string) => {
    const dollars = Number(drafts[categoryId] ?? 0);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    try {
      setView(await api.setAllocations(budgetId, month, [
        { categoryId, allocatedMinor: Math.round(dollars * 100) },
      ]));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

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

  const enterCommits = (categoryId: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAllocation(categoryId);
    }
  };

  return (
    <section>
      {error && <div className="error">{error}</div>}

      <div className="month-header">
        <h2 className="month-title">{monthLabel(month)}</h2>
        <div className="month-header-actions">
          <select
            className="select month-picker"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Select month"
          >
            {monthOptions(month).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {view === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="rta-hero">
            <span className="rta-hero-label">Ready to assign</span>
            <span
              className={
                view.readyToAssignMinor < 0
                  ? 'rta-hero-value negative'
                  : 'rta-hero-value'
              }
            >
              {formatMoney(view.readyToAssignMinor, currency)}
            </span>
            <div className="rta-actions" />
          </div>

          {view.groups.length === 0 ? (
            <div className="empty">
              <svg className="empty-illustration" viewBox="0 0 120 120" aria-hidden="true">
                <path d="M30 85 L30 45 C30 36.7 36.7 30 45 30 H75 C83.3 30 90 36.7 90 45 V85" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M60 55 V85" stroke-width="6" stroke-linecap="round"/>
                <path d="M45 70 H75" stroke-width="6" stroke-linecap="round"/>
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
            <table className="budget-grid">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="right">Assigned</th>
                  <th className="right">Activity</th>
                  <th className="right">Available</th>
                </tr>
              </thead>
              {view.groups.map((group) => {
                const available = group.categories.reduce(
                  (sum, category) => sum + category.availableMinor,
                  0,
                );
                return (
                  <tbody key={group.id}>
                    <tr className="group-row">
                      <td colSpan={4}>
                        <span className="group-band">
                          <span className="group-name">{group.name}</span>
                          <span className="group-total num">
                            {formatMoney(available, currency)}
                          </span>
                        </span>
                      </td>
                    </tr>
                    {group.categories.map((category) => (
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
                          <span
                            className={
                              category.availableMinor < 0
                                ? 'pill num negative'
                                : 'pill num'
                            }
                          >
                            {formatMoney(category.availableMinor, currency)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={4}>
                        <form
                          className="create-row compact"
                          onSubmit={(e) => addCategory(e, group.id)}
                        >
                          <input
                            className="input"
                            placeholder="New category in this group"
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
