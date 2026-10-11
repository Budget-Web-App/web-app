import { useEffect, useState } from 'react';
import { api, User } from '../lib/api';
import { Loading } from '../lib/Loading';
import { AuthPage } from '../features/auth/AuthPage';
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
      <main className="auth-wrap">
        <Loading />
      </main>
    );
  }
  if (!user) return <AuthPage onAuthed={setUser} />;

  const signOut = () => {
    api.logout().finally(() => setUser(null));
  };

  return <AppShell user={user} onSignOut={signOut} />;
}
