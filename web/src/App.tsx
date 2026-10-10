import { useEffect, useState } from 'react';
import { api, User } from './api';
import { AuthPage } from './AuthPage';
import { AppShell } from './AppShell';

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) {
    return (
      <div className="auth-wrap">
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (!user) return <AuthPage onAuthed={setUser} />;

  const signOut = () => {
    api.logout().finally(() => setUser(null));
  };

  return <AppShell user={user} onSignOut={signOut} />;
}