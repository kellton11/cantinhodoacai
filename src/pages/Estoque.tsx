import { useState } from 'react';
import { useStore } from '../store/StoreProvider';
import { useUI } from '../ui/UIProvider';
import { makeImage } from '../lib/reportImage';
import { isLow } from '../lib/stock';
import { num } from '../lib/format';

export default function Estoque() {
  const { db, addStock, setStockQty, deleteStock } = useStore();
  const ui = useUI();
  const [nome, setNome] = useState('');
  const [qtd, setQtd] = useState('');
  const [un, setUn] = useState('kg');
  const [min, setMin] = useState('');

  const rows = [...db.stock].sort((a, b) => a.name.localeCompare(b.name));

  async function add() {
    const n = nome.trim();
    if (!n) return ui.toast('Digite o nome do item.');
    await addStock({ name: n, qty: parseFloat(qtd) || 0, unit: un, min: parseFloat(min) || 0 });
    setNome('');
    setQtd('');
    setMin('');
  }

  async function remove(id: string) {
    if (await ui.confirm('Remover este item do estoque?')) await deleteStock(id);
  }

  async function acabou(id: string, name: string) {
    await setStockQty(id, 0);
    ui.toast(`“${name}” marcado como acabou e foi para a lista de compras.`);
  }

  function imagem() {
    const imgRows = rows.map((s) => ({ alert: isLow(s), v: [s.name, s.qty <= 0 ? 'ACABOU' : num(s.qty) + ' ' + s.unit] }));
    const url = makeImage(
      'O que tem no estoque',
      new Date().toLocaleDateString('pt-BR'),
      [{ label: 'Item', x: 0, w: 520 }, { label: 'Quantidade', x: 820, right: true }],
      imgRows,
      'Estoque vazio.',
    );
    ui.showImage(url, 'estoque-' + new Date().toISOString().slice(0, 10));
  }

  return (
    <>
      <div className="card">
        <h2>Adicionar item ao estoque</h2>
        <div className="row">
          <div style={{ flex: 2 }}>
            <label>Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Polpa de açaí" />
          </div>
          <div>
            <label>Quantidade</label>
            <input type="number" step="0.01" min="0" value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </div>
          <div>
            <label>Unidade</label>
            <select value={un} onChange={(e) => setUn(e.target.value)}>
              {['kg', 'un', 'L', 'pacote', 'caixa'].map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label>Avisar quando ≤</label>
            <input type="number" step="0.01" min="0" placeholder="mínimo" value={min} onChange={(e) => setMin(e.target.value)} />
          </div>
          <button onClick={() => void add()}>Adicionar</button>
        </div>
      </div>

      <div className="card">
        <h2>O que tem no estoque</h2>
        <table>
          <thead>
            <tr><th>Item</th><th className="r">Qtd</th><th>Un.</th><th className="r">Mínimo</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className={'r ' + (isLow(s) ? 'low' : '')}>
                  <input
                    key={s.id + ':' + s.qty}
                    style={{ width: 90, textAlign: 'right' }}
                    type="number"
                    step="0.01"
                    defaultValue={s.qty}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value) || 0;
                      if (v !== s.qty) void setStockQty(s.id, v);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                </td>
                <td>
                  {s.unit}
                  {s.qty <= 0 && <> <b className="low">ACABOU</b></>}
                </td>
                <td className="r">{s.min || '-'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="sec" disabled={s.qty <= 0} onClick={() => void acabou(s.id, s.name)}>Acabou</button>{' '}
                  <button className="x" onClick={() => void remove(s.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          {rows.length
            ? 'Vermelho = no mínimo ou acabou. Use o botão “Acabou” quando um item terminar: ele vai para a lista de compras.'
            : 'Nenhum item cadastrado ainda.'}
        </p>
        <button style={{ marginTop: 10 }} onClick={imagem}>🖼️ Gerar imagem: O que tem no estoque</button>
      </div>
    </>
  );
}
