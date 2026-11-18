import { useState } from 'react';
import { UIProvider, useUI } from './ui/UIProvider';
import { StoreProvider, useStore } from './store/StoreProvider';
import AuthGate from './components/AuthGate';
import Caixa from './pages/Caixa';
import Estoque from './pages/Estoque';
import Compras from './pages/Compras';
import Produtos from './pages/Produtos';
import Despesas from './pages/Despesas';
import Relatorios from './pages/Relatorios';
import { hashPassword } from './lib/hash';
import { storageMode } from './data';
import type { TabId } from './types';

const TABS: { id: TabId; label: string }[] = [
  { id: 'caixa', label: 'Caixa' },
  { id: 'estoque', label: 'Estoque' },
  { id: 'compras', label: 'O que comprar' },
  { id: 'produtos', label: 'Produtos e preços' },
  { id: 'despesas', label: 'Despesas' },
  { id: 'relatorios', label: 'Relatórios' },
];

export default function App() {
  return (
    <UIProvider>
      <AuthGate>
        <StoreProvider>
          <Shell />
        </StoreProvider>
      </AuthGate>
    </UIProvider>
  );
}

function Shell() {
  const { db, loading, setSettings } = useStore();
  const ui = useUI();
  const [tab, setTab] = useState<TabId>('caixa');
  const [unlocked, setUnlocked] = useState(false);
  const hasPass = db.settings.passHash !== '';

  /** Pede a senha (se existir e ainda não foi digitada). */
  async function ensureAuth(): Promise<boolean> {
    if (!hasPass || unlocked) return true;
    const p = await ui.askPassword('Digite a senha', false);
    if (p === null) return false;
    if ((await hashPassword(p)) === db.settings.passHash) {
      setUnlocked(true);
      return true;
    }
    ui.toast('Senha incorreta.');
    return false;
  }

  /** Senha do dono para uma ação pontual (ex.: cancelar venda). Não libera as abas. */
  async function confirmOwner(): Promise<boolean> {
    if (unlocked) return true;
    if (!hasPass) {
      const p = await ui.askPassword('Crie uma senha para poder cancelar vendas', true);
      if (!p) return false;
      await setSettings({ passHash: await hashPassword(p) });
      return true;
    }
    const p = await ui.askPassword('Senha do dono', false);
    if (p === null) return false;
    if ((await hashPassword(p)) === db.settings.passHash) return true;
    ui.toast('Senha incorreta.');
    return false;
  }

  async function go(t: TabId) {
    if (db.settings.lockedTabs.includes(t) && !unlocked) {
      if (!hasPass) {
        const p = await ui.askPassword('Crie uma senha para proteger o sistema', true);
        if (!p) return;
        await setSettings({ passHash: await hashPassword(p) });
        setUnlocked(true);
      } else if (!(await ensureAuth())) {
        return;
      }
    }
    setTab(t);
  }

  function bloquear() {
    setUnlocked(false);
    if (db.settings.lockedTabs.includes(tab)) setTab('caixa');
  }

  return (
    <>
      <header>
        <h1>🍇 Cantinho do Açaí</h1>
        <span className="badge">{storageMode === 'supabase' ? '☁ Supabase' : '💾 Neste computador'}</span>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => void go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        {unlocked && hasPass && <button className="sec" onClick={bloquear}>🔒 Bloquear</button>}
      </header>
      <main>
        {loading ? (
          <p>Carregando…</p>
        ) : (
          <>
            {/* O Caixa fica sempre montado para não perder o pedido ao trocar de aba */}
            <section className={tab === 'caixa' ? 'on' : ''}><Caixa confirmOwner={confirmOwner} /></section>
            {tab === 'estoque' && <section className="on"><Estoque /></section>}
            {tab === 'compras' && <section className="on"><Compras /></section>}
            {tab === 'produtos' && (
              <section className="on">
                <Produtos ensureAuth={ensureAuth} onPasswordSet={() => setUnlocked(true)} />
              </section>
            )}
            {tab === 'despesas' && <section className="on"><Despesas /></section>}
            {tab === 'relatorios' && <section className="on"><Relatorios /></section>}
          </>
        )}
      </main>
    </>
  );
}
