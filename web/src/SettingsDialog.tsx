import { useEffect, useRef } from 'react';
import { User } from './api';
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
  membersPath,
  onSignOut,
  onClose,
}: {
  user: User;
  membersPath?: string;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        {membersPath && (
          <div className="modal-section">
            <div className="sidebar-section-label dark">This budget</div>
            <button className="btn" onClick={() => { navigate(membersPath); onClose(); }}>
              Manage members
            </button>
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
