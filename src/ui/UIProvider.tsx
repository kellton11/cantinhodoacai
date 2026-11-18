import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Modal from '../components/Modal';

interface UIApi {
  toast: (msg: string) => void;
  confirm: (msg: string) => Promise<boolean>;
  askPassword: (title: string, confirmMode: boolean) => Promise<string | null>;
  askText: (title: string, label: string) => Promise<string | null>;
  showImage: (url: string, name: string) => void;
}

const UIContext = createContext<UIApi | null>(null);

export function useUI(): UIApi {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI fora do UIProvider');
  return ctx;
}

type Dialog =
  | { kind: 'confirm'; msg: string; resolve: (v: boolean) => void }
  | { kind: 'password'; title: string; confirmMode: boolean; resolve: (v: string | null) => void }
  | { kind: 'text'; title: string; label: string; resolve: (v: string | null) => void }
  | null;

export function UIProvider({ children }: { children: ReactNode }) {
  const [toastMsg, setToastMsg] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [image, setImage] = useState<{ url: string; name: string } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastMsg(''), 3500);
  }, []);

  const confirm = useCallback(
    (msg: string) => new Promise<boolean>((resolve) => setDialog({ kind: 'confirm', msg, resolve })),
    [],
  );

  const askPassword = useCallback(
    (title: string, confirmMode: boolean) =>
      new Promise<string | null>((resolve) => setDialog({ kind: 'password', title, confirmMode, resolve })),
    [],
  );

  const askText = useCallback(
    (title: string, label: string) =>
      new Promise<string | null>((resolve) => setDialog({ kind: 'text', title, label, resolve })),
    [],
  );

  const showImage = useCallback((url: string, name: string) => setImage({ url, name }), []);

  const api = useMemo<UIApi>(
    () => ({ toast, confirm, askPassword, askText, showImage }),
    [toast, confirm, askPassword, askText, showImage],
  );

  return (
    <UIContext.Provider value={api}>
      {children}

      {dialog?.kind === 'confirm' && (
        <Modal narrow>
          <p style={{ fontSize: 17, margin: '0 0 14px' }}>{dialog.msg}</p>
          <div className="row">
            <button
              className="sec"
              onClick={() => {
                dialog.resolve(false);
                setDialog(null);
              }}
            >
              Não
            </button>
            <button
              className="bad"
              onClick={() => {
                dialog.resolve(true);
                setDialog(null);
              }}
            >
              Sim
            </button>
          </div>
        </Modal>
      )}

      {dialog?.kind === 'password' && (
        <PasswordDialog
          title={dialog.title}
          confirmMode={dialog.confirmMode}
          onDone={(v) => {
            dialog.resolve(v);
            setDialog(null);
          }}
        />
      )}

      {dialog?.kind === 'text' && (
        <TextDialog
          title={dialog.title}
          label={dialog.label}
          onDone={(v) => {
            dialog.resolve(v);
            setDialog(null);
          }}
        />
      )}

      {image && (
        <Modal>
          <img src={image.url} alt="Relatório" className="report-img" />
          <div className="row" style={{ marginTop: 10 }}>
            <a className="btn ok" href={image.url} download={image.name + '.png'} style={{ textAlign: 'center', textDecoration: 'none' }}>
              ⬇ Baixar imagem
            </a>
            <button className="sec" onClick={() => setImage(null)}>
              Fechar
            </button>
          </div>
        </Modal>
      )}

      {toastMsg && <div className="toast">{toastMsg}</div>}
    </UIContext.Provider>
  );
}

function PasswordDialog({
  title,
  confirmMode,
  onDone,
}: {
  title: string;
  confirmMode: boolean;
  onDone: (v: string | null) => void;
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');

  const ok = () => {
    if (a.length < 4) return setErr('Use pelo menos 4 caracteres.');
    if (confirmMode && a !== b) return setErr('As senhas não são iguais.');
    onDone(a);
  };

  return (
    <Modal narrow>
      <h2>{title}</h2>
      <input
        type="password"
        placeholder="Senha"
        autoComplete="off"
        autoFocus
        value={a}
        onChange={(e) => setA(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && ok()}
      />
      {confirmMode && (
        <input
          type="password"
          placeholder="Repita a senha"
          autoComplete="off"
          style={{ marginTop: 8 }}
          value={b}
          onChange={(e) => setB(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ok()}
        />
      )}
      {err && <p style={{ color: 'var(--verm)', fontSize: 14, margin: '8px 0 0' }}>{err}</p>}
      <div className="row" style={{ marginTop: 12 }}>
        <button className="sec" onClick={() => onDone(null)}>
          Cancelar
        </button>
        <button onClick={ok}>OK</button>
      </div>
    </Modal>
  );
}

function TextDialog({ title, label, onDone }: { title: string; label: string; onDone: (v: string | null) => void }) {
  const [v, setV] = useState('');
  return (
    <Modal narrow>
      <h2>{title}</h2>
      <label>{label}</label>
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onDone(v)} />
      <div className="row" style={{ marginTop: 12 }}>
        <button className="sec" onClick={() => onDone(null)}>
          Voltar
        </button>
        <button className="bad" onClick={() => onDone(v)}>
          Confirmar
        </button>
      </div>
    </Modal>
  );
}
