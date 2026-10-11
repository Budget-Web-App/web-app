import { useEffect, useState } from 'react';
import { Budget, User, api, errorMessage } from '../../lib/api';
import { hasRole } from '../../lib/roles';
import { Modal, useConfirm } from '../../lib/Modal';
import { Link } from '../../app/Link';

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
  const [rename, setRename] = useState(budget?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

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
    const ok = await confirm({
      title: `Delete "${budget.name}"?`,
      message: 'This removes the budget and all of its data. It cannot be undone.',
      confirmLabel: 'Delete budget',
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await api.deleteBudget(budget.id);
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      <Modal title="Settings" onClose={onClose}>
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
              <form
                className="dialog-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveName();
                }}
              >
                <input
                  className="input"
                  value={rename}
                  onChange={(e) => setRename(e.target.value)}
                  aria-label="Budget name"
                  autoComplete="off"
                />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!rename.trim() || rename === budget.name}
                >
                  Save name
                </button>
              </form>
            )}
            <div className="dialog-row">
              <Link
                className="btn"
                to={`/budgets/${encodeURIComponent(budget.id)}/members`}
                onClick={onClose}
              >
                Manage members
              </Link>
              {hasRole(budget.role, 'owner') && (
                <button type="button" className="btn btn-danger" onClick={deleteBudget}>
                  Delete budget
                </button>
              )}
            </div>
            {error && <div className="error" role="alert">{error}</div>}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onSignOut}>Sign out</button>
          <button type="button" className="btn btn-primary" data-autofocus onClick={onClose}>Done</button>
        </div>
      </Modal>
      {confirmDialog}
    </>
  );
}
