import { FormEvent, useState } from 'react';
import { User, api, errorMessage } from '../../lib/api';
import { Pricing } from './Pricing';

export function AuthPage({ onAuthed }: { onAuthed: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { user } =
        mode === 'login'
          ? await api.login(email, password)
          : await api.signup(email, password, name);
      onAuthed(user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-wrap">
      <div className="auth">
        <h1 className="brand-mark">
          <span className="brand-logo" aria-hidden="true">1</span>
          OneBudget
        </h1>
        <p className="auth-tagline">Give every dollar a job.</p>
        <div className="auth-tabs" role="group" aria-label="Sign in or create an account">
          <button
            type="button"
            className="auth-tab"
            aria-pressed={mode === 'login'}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className="auth-tab"
            aria-pressed={mode === 'signup'}
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
          >
            Create account
          </button>
        </div>
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
                required
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              spellCheck={false}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              minLength={8}
              aria-describedby={mode === 'signup' ? 'password-hint' : undefined}
              required
            />
            {mode === 'signup' && (
              <p id="password-hint" className="muted small field-hint">
                At least 8 characters.
              </p>
            )}
          </div>
          {error && <div className="error" role="alert">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy} aria-busy={busy || undefined}>
            {busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
      <Pricing />
    </main>
  );
}