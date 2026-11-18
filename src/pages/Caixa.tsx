import { useState } from 'react';
import { useStore } from '../store/StoreProvider';
import type { CartItem } from '../store/StoreProvider';
import { useUI } from '../ui/UIProvider';
import { useScale } from '../lib/scale';
import CashBar from '../components/CashBar';
import { brl, fdt, num, round2, uid } from '../lib/format';
import type { PayMethod, Sale } from '../types';

interface Props {
  /** Pede a senha do dono (usada para cancelar vendas). */
  confirmOwner: () => Promise<boolean>;
}

export default function Caixa({ confirmOwner }: Props) {
  const { db, openSession, finalizeSale, voidSale } = useStore();
  const ui = useUI();
  const s = db.settings;
  const scale = useScale(s.baud, s.unit);

  const [manualG, setManualG] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pay, setPay] = useState<PayMethod>('Dinheiro');
  const [recebido, setRecebido] = useState('');
  const [discType, setDiscType] = useState<'R$' | '%'>('R$');
  const [discVal, setDiscVal] = useState('');
  const [courtesy, setCourtesy] = useState(false);

  const manual = manualG === '' ? null : parseFloat(manualG) / 1000;
  const weight = manual !== null && Number.isFinite(manual) ? manual : scale.kg;

  const subtotal = round2(cart.reduce((a, c) => a + c.total, 0));
  const dv = parseFloat(discVal) || 0;
  const rawDisc = courtesy ? subtotal : discType === '%' ? (subtotal * dv) / 100 : dv;
  const discount = round2(Math.min(Math.max(rawDisc, 0), subtotal));
  const total = round2(subtotal - discount);
  const rec = parseFloat(recebido) || 0;
  const troco = rec - total;

  function resetOrder() {
    setCart([]);
    setRecebido('');
    setDiscVal('');
    setDiscType('R$');
    setCourtesy(false);
  }

  function addAcai() {
    if (weight <= 0) return ui.toast('Coloque o açaí na balança ou digite o peso.');
    setCart((c) => [
      ...c,
      {
        key: uid(),
        kind: 'peso',
        name: `Açaí ${Math.round(weight * 1000)}g`,
        qty: weight,
        total: weight * s.pricePerKg,
        unitCost: s.acaiCostPerKg,
        stockId: s.acaiStockId,
      },
    ]);
    setManualG('');
  }

  function addProduct(id: string) {
    const p = db.products.find((x) => x.id === id);
    if (!p) return;
    setCart((c) => {
      const ex = c.find((i) => i.kind === 'un' && i.pid === p.id);
      if (ex) return c.map((i) => (i === ex ? { ...i, qty: i.qty + 1, total: (i.qty + 1) * p.price } : i));
      return [
        ...c,
        { key: uid(), kind: 'un', pid: p.id, name: p.name, qty: 1, total: p.price, unitCost: p.cost, stockId: p.stockId },
      ];
    });
  }

  async function cancelar() {
    if (!cart.length || (await ui.confirm('Cancelar o pedido atual?'))) resetOrder();
  }

  async function finalizar() {
    if (!cart.length) return ui.toast('O pedido está vazio.');
    if (pay === 'Dinheiro' && total > 0 && rec > 0 && rec < total - 0.001) return ui.toast('O valor recebido é menor que o total.');
    const sale = await finalizeSale(cart, pay, rec, discount);
    if (!sale) return;
    const t = pay === 'Dinheiro' && rec > total && total > 0 ? `\nTroco: ${brl(rec - total)}` : '';
    resetOrder();
    ui.toast((courtesy ? 'Cortesia registrada. ' : 'Venda finalizada! ') + brl(total) + t);
  }

  async function cancelarVenda(sale: Sale) {
    if (!(await confirmOwner())) return;
    const reason = await ui.askText(`Cancelar venda de ${brl(sale.total)}?`, 'Motivo (opcional). O estoque será devolvido.');
    if (reason === null) return;
    if (await voidSale(sale.id, reason.trim())) ui.toast('Venda cancelada e estoque devolvido.');
  }

  const caixaSales = openSession ? db.sales.filter((x) => x.cashId === openSession.id).reverse() : [];

  return (
    <>
      <CashBar cartEmpty={cart.length === 0} />
      <div className="grid">
        <div>
          <div className="card">
            <h2>Balança</h2>
            <div className="peso">
              <span>{weight.toFixed(3).replace('.', ',')}</span> <small>kg</small>
            </div>
            <div className="status" style={{ color: scale.error ? 'var(--verm)' : scale.connected ? 'var(--verde)' : undefined }}>
              {scale.error || (scale.connected ? '✅ Balança conectada' : 'Balança não conectada – você pode digitar o peso abaixo.')}
            </div>
            <div className="row">
              {!scale.connected ? (
                <button className="sec" onClick={() => void scale.connect()}>🔌 Conectar balança</button>
              ) : (
                <button className="sec" onClick={() => void scale.disconnect()}>Desconectar</button>
              )}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <div>
                <label>Peso manual (gramas)</label>
                <input type="number" min="0" placeholder="ex.: 350" value={manualG} onChange={(e) => setManualG(e.target.value)} />
              </div>
              <div>
                <label>Preço por kg</label>
                <input disabled value={brl(s.pricePerKg) + ' / kg'} />
              </div>
            </div>
            <div className="valor">{brl(weight * s.pricePerKg)}</div>
            <button className="ok" style={{ width: '100%', fontSize: 18, marginTop: 6 }} onClick={addAcai}>
              ➕ Adicionar açaí ao pedido
            </button>
          </div>

          <div className="card">
            <h2>Itens (bebidas, adicionais...)</h2>
            <div className="prods">
              {db.products.length === 0 && <span className="hint">Cadastre itens na aba “Produtos e preços”.</span>}
              {db.products.map((p) => (
                <button key={p.id} onClick={() => addProduct(p.id)}>
                  {p.name}
                  <b>{brl(p.price)}</b>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <h2>Pedido atual</h2>
            <table>
              <thead>
                <tr><th>Item</th><th className="r">Qtd</th><th className="r">Valor</th><th></th></tr>
              </thead>
              <tbody>
                {cart.length === 0 && <tr><td colSpan={4} className="hint">Pedido vazio</td></tr>}
                {cart.map((c) => (
                  <tr key={c.key}>
                    <td>{c.name}</td>
                    <td className="r">{c.kind === 'peso' ? num(c.qty) + ' kg' : c.qty}</td>
                    <td className="r">{brl(c.total)}</td>
                    <td><button className="x" onClick={() => setCart((l) => l.filter((i) => i.key !== c.key))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {cart.length > 0 && (
              <div className="row" style={{ marginTop: 10 }}>
                <div>
                  <label>Desconto</label>
                  <input type="number" step="0.01" min="0" disabled={courtesy} value={discVal} onChange={(e) => setDiscVal(e.target.value)} />
                </div>
                <div style={{ maxWidth: 90 }}>
                  <label>Tipo</label>
                  <select disabled={courtesy} value={discType} onChange={(e) => setDiscType(e.target.value as 'R$' | '%')}>
                    <option value="R$">R$</option>
                    <option value="%">%</option>
                  </select>
                </div>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0, paddingBottom: 10, fontSize: 15, color: 'inherit' }}>
                  <input type="checkbox" style={{ width: 'auto' }} checked={courtesy} onChange={(e) => setCourtesy(e.target.checked)} />
                  🎁 Cortesia
                </label>
              </div>
            )}

            {discount > 0 && (
              <div className="hint" style={{ textAlign: 'right', marginTop: 8 }}>
                Subtotal {brl(subtotal)} · {courtesy ? 'Cortesia' : 'Desconto'} − {brl(discount)}
              </div>
            )}
            <div className="total">{brl(total)}</div>

            <div className="pay">
              {([['Dinheiro', '💵 Dinheiro'], ['Pix', '⚡ Pix'], ['Cartão', '💳 Cartão']] as [PayMethod, string][]).map(([m, label]) => (
                <button key={m} className={pay === m ? 'on' : ''} onClick={() => setPay(m)}>{label}</button>
              ))}
            </div>

            {pay === 'Dinheiro' && total > 0 && (
              <div className="row">
                <div>
                  <label>Valor recebido</label>
                  <input type="number" step="0.01" min="0" value={recebido} onChange={(e) => setRecebido(e.target.value)} />
                </div>
                <div>
                  <label>Troco</label>
                  <input disabled value={rec > 0 ? (troco >= 0 ? brl(troco) : 'Faltam ' + brl(-troco)) : ''} />
                </div>
              </div>
            )}

            <div className="row" style={{ marginTop: 12 }}>
              <button className="bad" onClick={() => void cancelar()}>Cancelar pedido</button>
              <button className="ok" style={{ fontSize: 18, flex: 2 }} onClick={() => void finalizar()}>
                {courtesy ? '🎁 Registrar cortesia' : '✔ Finalizar venda'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {openSession && (
        <div className="card">
          <h2>Vendas deste caixa</h2>
          <table>
            <thead>
              <tr><th>Hora</th><th>Itens</th><th>Pgto</th><th className="r">Total</th><th></th></tr>
            </thead>
            <tbody>
              {caixaSales.length === 0 && <tr><td colSpan={5} className="hint">Nenhuma venda neste caixa ainda.</td></tr>}
              {caixaSales.map((x) => (
                <tr key={x.id} className={x.voidedAt ? 'cancelled' : ''}>
                  <td>{fdt(x.date)}</td>
                  <td>
                    {x.items.map((i) => i.name).join(', ')}
                    {x.discount > 0 && x.total > 0 && <span className="hint"> (desc. {brl(x.discount)})</span>}
                  </td>
                  <td>{x.total === 0 && x.discount > 0 ? '🎁 Cortesia' : x.pay}</td>
                  <td className="r">{brl(x.total)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {x.voidedAt ? (
                      <span className="hint">cancelada{x.voidReason ? ': ' + x.voidReason : ''}</span>
                    ) : (
                      <button className="sec" onClick={() => void cancelarVenda(x)}>Cancelar venda</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">Cancelar uma venda pede a senha, devolve o item ao estoque e tira o valor do caixa.</p>
        </div>
      )}
    </>
  );
}
