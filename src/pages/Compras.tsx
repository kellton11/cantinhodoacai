import { useState } from 'react';
import { useStore } from '../store/StoreProvider';
import { useUI } from '../ui/UIProvider';
import { makeImage } from '../lib/reportImage';
import { lowItems } from '../lib/stock';

export default function Compras() {
  const { db, addShopping, toggleShopping, deleteShopping } = useStore();
  const ui = useUI();
  const [nome, setNome] = useState('');
  const [qtd, setQtd] = useState('');

  const auto = lowItems(db.stock);

  async function add() {
    const n = nome.trim();
    if (!n) return ui.toast('Digite o item.');
    await addShopping(n, qtd.trim());
    setNome('');
    setQtd('');
  }

  function imagem() {
    const rows = [...auto, ...db.shopping.filter((s) => !s.done).map((s) => ({ name: s.name, need: s.need }))].map((a) => ({
      v: [a.name, a.need || '-'],
    }));
    const url = makeImage(
      'O que falta comprar',
      new Date().toLocaleDateString('pt-BR'),
      [{ label: 'Item', x: 0, w: 340 }, { label: 'Quantidade', x: 380, w: 440 }],
      rows,
      'Nada para comprar no momento.',
    );
    ui.showImage(url, 'lista-de-compras-' + new Date().toISOString().slice(0, 10));
  }

  return (
    <>
      <div className="card">
        <h2>Adicionar à lista de compras</h2>
        <div className="row">
          <div style={{ flex: 2 }}>
            <label>Item</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Granola" />
          </div>
          <div>
            <label>Quantidade</label>
            <input value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="ex.: 5 kg" />
          </div>
          <button onClick={() => void add()}>Adicionar</button>
        </div>
        <p className="hint">Itens do estoque que acabarem ou chegarem no mínimo aparecem sozinhos aqui embaixo.</p>
      </div>

      <div className="card">
        <h2>O que falta comprar</h2>
        <table>
          <thead>
            <tr><th></th><th>Item</th><th>Comprar</th><th></th></tr>
          </thead>
          <tbody>
            {auto.map((a) => (
              <tr key={'auto-' + a.name}>
                <td>⚠️</td><td>{a.name}</td><td>{a.need}</td><td></td>
              </tr>
            ))}
            {db.shopping.map((s) => (
              <tr key={s.id} style={s.done ? { opacity: 0.5, textDecoration: 'line-through' } : undefined}>
                <td>
                  <input type="checkbox" style={{ width: 'auto' }} checked={s.done} onChange={() => void toggleShopping(s.id)} />
                </td>
                <td>{s.name}</td>
                <td>{s.need}</td>
                <td><button className="x" onClick={() => void deleteShopping(s.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">{auto.length || db.shopping.length ? '' : 'Nada para comprar no momento.'}</p>
        <button style={{ marginTop: 10 }} onClick={imagem}>🖼️ Gerar imagem: O que falta comprar</button>
      </div>
    </>
  );
}
