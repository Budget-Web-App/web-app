import { FormEvent, useState } from 'react';
import { User, api, errorMessage } from './api';
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
        <div className="brand-mark">
          <span className="brand-logo" aria-hidden="true">1</span>
          OneBudget
        </div>
        <p className="auth-tagline">Give every dollar a job.</p>
        <div className="auth-tabs" role="tablist">
          <button
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            className={mode === 'signup' ? 'auth-tab active' : 'auth-tab'}
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
              required
            />
          </div>
          {error && <div className="error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
      <Pricing />
    </main>
  );
}