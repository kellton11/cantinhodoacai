import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

/**
 * Sem Supabase configurado: mostra o sistema direto.
 * Com Supabase: pede e-mail e senha do usuário criado em Authentication > Users.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  if (!supabase) return <>{children}</>;
  return <SupabaseLogin client={supabase}>{children}</SupabaseLogin>;
}

function SupabaseLogin({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [client]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (err) setError('E-mail ou senha incorretos.');
    setBusy(false);
  }

  if (checking) return <div className="login"><p>Carregando…</p></div>;

  if (!session) {
    return (
      <div className="login">
        <form className="card" onSubmit={entrar}>
          <h1>🍇 Cantinho do Açaí</h1>
          <label>E-mail</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          <label style={{ marginTop: 8 }}>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p style={{ color: 'var(--verm)' }}>{error}</p>}
          <button type="submit" disabled={busy} style={{ width: '100%', marginTop: 12 }}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      {children}
      <button className="sec logout" onClick={() => void client.auth.signOut()}>
        Sair da conta
      </button>
    </>
  );
}
