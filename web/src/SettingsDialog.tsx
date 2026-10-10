import { useEffect, useRef, useState } from 'react';
import { Budget, User, api, errorMessage } from './api';
import { hasRole } from './roles';
import { navigate } from './router';

export function GearIcon() {
  return (
    <svg className="gear" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function SettingsDialog({
  user,
  budget,
  onSignOut,
  onClose,
  onChanged,
  onDeleted,
}: {
  user: User;
  budget?: Budget;
  onSignOut: () => void;
  onClose: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [rename, setRename] = useState(budget?.name ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => setRename(budget?.name ?? ''), [budget?.name]);

  const saveName = async () => {
    if (!budget || !rename.trim() || rename === budget.name) return;
    setError(null);
    try {
      await api.renameBudget(budget.id, rename.trim());
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const deleteBudget = async () => {
    if (!budget) return;
    if (
      !window.confirm(
        `Delete "${budget.name}" and all of its data? This cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api.deleteBudget(budget.id);
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Settings" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <div className="modal-section">
          <div className="sidebar-section-label dark">Account</div>
          <div className="account-row">
            <span className="avatar big" aria-hidden="true">{user.name.trim().charAt(0)}</span>
            <div>
              <strong>{user.name}</strong>
              <div className="muted">{user.email}</div>
            </div>
          </div>
        </div>
        {budget && (
          <div className="modal-section">
            <div className="sidebar-section-label dark">This budget</div>
            {hasRole(budget.role, 'editor') && (
              <div className="dialog-row">
                <input
                  className="input"
                  value={rename}
                  onChange={(e) => setRename(e.target.value)}
                  aria-label="Budget name"
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={saveName}
                  disabled={!rename.trim() || rename === budget.name}
                >
                  Save name
                </button>
              </div>
            )}
            <div className="dialog-row">
              <button
                className="btn"
                onClick={() => {
                  navigate(`/budgets/${encodeURIComponent(budget.id)}/members`);
                  onClose();
                }}
              >
                Manage members
              </button>
              {hasRole(budget.role, 'owner') && (
                <button className="btn btn-danger" onClick={deleteBudget}>
                  Delete budget
                </button>
              )}
            </div>
            {error && <div className="error">{error}</div>}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onSignOut}>Sign out</button>
          <button className="btn btn-primary" onClick={onClose} ref={closeRef}>Done</button>
        </div>
      </div>
    </div>
  );
}
