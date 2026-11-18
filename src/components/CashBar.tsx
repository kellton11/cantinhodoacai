import { useState } from 'react';
import { useStore } from '../store/StoreProvider';
import { useUI } from '../ui/UIProvider';
import Modal from './Modal';
import { cashImage, cashSummary } from '../lib/cash';
import { brl, fdt, round2 } from '../lib/format';

type Dlg = null | 'open' | 'in' | 'out' | 'close';

export default function CashBar({ cartEmpty }: { cartEmpty: boolean }) {
  const { db, openSession, openCash, addCashMove, closeCash } = useStore();
  const ui = useUI();
  const [dlg, setDlg] = useState<Dlg>(null);
  const [val, setVal] = useState('');
  const [note, setNote] = useState('');

  const start = (d: Dlg) => {
    if (d === 'close' && !cartEmpty) {
      ui.toast('Finalize ou cancele o pedido atual antes de fechar o caixa.');
      return;
    }
    setVal(d === 'open' ? '0' : '');
    setNote('');
    setDlg(d);
  };

  const sm = openSession ? cashSummary(openSession, db.sales) : null;

  async function confirmOpen() {
    const v = parseFloat(val);
    if (!(v >= 0)) return ui.toast('Informe o valor do troco inicial (pode ser 0).');
    await openCash(v);
    setDlg(null);
    ui.toast('Caixa aberto!');
  }

  async function confirmMove(type: 'in' | 'out') {
    const v = parseFloat(val);
    if (!(v > 0)) return ui.toast('Informe um valor maior que zero.');
    await addCashMove(type, v, note.trim());
    setDlg(null);
  }

  async function confirmClose() {
    const v = parseFloat(val);
    if (!(v >= 0)) return ui.toast('Conte o dinheiro da gaveta e digite o valor.');
    const closed = await closeCash(v);
    setDlg(null);
    if (closed) {
      const img = cashImage(closed, db.sales);
      ui.showImage(img.url, img.name);
    }
  }

  const counted = parseFloat(val);
  const diff = sm && Number.isFinite(counted) ? round2(counted - sm.expected) : null;

  return (
    <>
      <div className="card">
        {!openSession ? (
          <div className="row" style={{ alignItems: 'center' }}>
            <div style={{ flex: 3 }}>
              <b style={{ color: 'var(--verm)' }}>● CAIXA FECHADO</b>
              <div className="hint">Abra o caixa para começar a vender.</div>
            </div>
            <button className="ok" onClick={() => start('open')}>Abrir caixa</button>
          </div>
        ) : (
          <div className="row" style={{ alignItems: 'center' }}>
            <div style={{ flex: 3, minWidth: 200 }}>
              <b style={{ color: 'var(--verde)' }}>● CAIXA ABERTO</b> desde {fdt(openSession.openedAt)}
              <div className="hint">
                Troco inicial {brl(openSession.opening)} · {sm?.n} venda(s) · {brl(sm?.tot ?? 0)}
              </div>
            </div>
            <button className="sec" onClick={() => start('in')}>＋ Entrada</button>
            <button className="sec" onClick={() => start('out')}>− Retirada</button>
            <button className="bad" onClick={() => start('close')}>Fechar caixa</button>
          </div>
        )}
      </div>

      {dlg === 'open' && (
        <Modal narrow>
          <h2>Abrir caixa</h2>
          <label>Dinheiro na gaveta (troco inicial)</label>
          <input type="number" step="0.01" min="0" autoFocus value={val} onChange={(e) => setVal(e.target.value)} />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="sec" onClick={() => setDlg(null)}>Cancelar</button>
            <button className="ok" onClick={() => void confirmOpen()}>Abrir caixa</button>
          </div>
        </Modal>
      )}

      {(dlg === 'in' || dlg === 'out') && (
        <Modal narrow>
          <h2>{dlg === 'in' ? 'Entrada de dinheiro' : 'Retirada de dinheiro'}</h2>
          <label>Valor (R$)</label>
          <input type="number" step="0.01" min="0" autoFocus value={val} onChange={(e) => setVal(e.target.value)} />
          <label style={{ marginTop: 8 }}>Motivo</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={dlg === 'in' ? 'ex.: reforço de troco' : 'ex.: pagamento de fornecedor'}
          />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="sec" onClick={() => setDlg(null)}>Cancelar</button>
            <button onClick={() => void confirmMove(dlg)}>Salvar</button>
          </div>
        </Modal>
      )}

      {dlg === 'close' && openSession && sm && (
        <Modal>
          <h2>Fechar caixa</h2>
          <table>
            <tbody>
              <tr><td>Troco inicial</td><td className="r">{brl(openSession.opening)}</td></tr>
              <tr><td>Vendas em dinheiro</td><td className="r">{brl(sm.por.Dinheiro)}</td></tr>
              <tr><td>Entradas</td><td className="r">{brl(sm.sup)}</td></tr>
              <tr><td>Retiradas</td><td className="r">− {brl(sm.san)}</td></tr>
              <tr><td><b>Dinheiro que deve ter na gaveta</b></td><td className="r"><b>{brl(sm.expected)}</b></td></tr>
              <tr><td>Vendas no Pix</td><td className="r">{brl(sm.por.Pix)}</td></tr>
              <tr><td>Vendas no cartão</td><td className="r">{brl(sm.por['Cartão'])}</td></tr>
              <tr><td><b>Total vendido ({sm.n} vendas)</b></td><td className="r"><b>{brl(sm.tot)}</b></td></tr>
              {sm.disc > 0 && <tr><td>Descontos e cortesias dados</td><td className="r">{brl(sm.disc)}</td></tr>}
              {sm.nVoid > 0 && <tr><td>Vendas canceladas</td><td className="r">{sm.nVoid}</td></tr>}
            </tbody>
          </table>
          <label style={{ marginTop: 12 }}>Dinheiro contado na gaveta (R$)</label>
          <input type="number" step="0.01" min="0" autoFocus value={val} onChange={(e) => setVal(e.target.value)} />
          {diff !== null && (
            <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8, color: diff === 0 ? 'var(--verde)' : 'var(--verm)' }}>
              {diff === 0 ? '✔ Caixa batendo' : diff > 0 ? 'Sobra ' + brl(diff) : 'Falta ' + brl(-diff)}
            </div>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="sec" onClick={() => setDlg(null)}>Voltar</button>
            <button className="bad" onClick={() => void confirmClose()}>Confirmar fechamento</button>
          </div>
        </Modal>
      )}
    </>
  );
}
