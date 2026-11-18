import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreProvider';
import { useUI } from '../ui/UIProvider';
import { makeImage } from '../lib/reportImage';
import { cashImage, cashSummary } from '../lib/cash';
import { PERIOD_NAMES, computeStats } from '../lib/stats';
import type { Period, TopStat } from '../lib/stats';
import { isLow, lowItems } from '../lib/stock';
import { brl, fdt, num, round2 } from '../lib/format';

const qtyTxt = (t: TopStat): string => (t.kind === 'peso' ? num(t.qty) + ' kg' : Math.round(t.qty) + ' un');
const today = (): string => new Date().toISOString().slice(0, 10);

export default function Relatorios() {
  const { db } = useStore();
  const ui = useUI();
  const [period, setPeriod] = useState<Period>('hoje');
  const st = useMemo(() => computeStats(db.sales, period), [db.sales, period]);
  const label = PERIOD_NAMES[period];

  const closed = db.cash.filter((c) => c.closedAt !== null).reverse();

  function imgEstoque() {
    const rows = [...db.stock]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ alert: isLow(s), v: [s.name, s.qty <= 0 ? 'ACABOU' : num(s.qty) + ' ' + s.unit] }));
    ui.showImage(
      makeImage('O que tem no estoque', new Date().toLocaleDateString('pt-BR'), [{ label: 'Item', x: 0, w: 520 }, { label: 'Quantidade', x: 820, right: true }], rows, 'Estoque vazio.'),
      'estoque-' + today(),
    );
  }

  function imgCompras() {
    const rows = [...lowItems(db.stock), ...db.shopping.filter((s) => !s.done).map((s) => ({ name: s.name, need: s.need }))].map((a) => ({
      v: [a.name, a.need || '-'],
    }));
    ui.showImage(
      makeImage('O que falta comprar', new Date().toLocaleDateString('pt-BR'), [{ label: 'Item', x: 0, w: 340 }, { label: 'Quantidade', x: 380, w: 440 }], rows, 'Nada para comprar no momento.'),
      'lista-de-compras-' + today(),
    );
  }

  function imgPeriodo() {
    const rows = Object.entries(st.por).map(([k, v]) => ({ v: [k, brl(v)] }));
    rows.push({ v: [`TOTAL (${st.sales.length} vendas)`, brl(st.total)] });
    rows.push({ v: ['Descontos e cortesias dados', brl(st.discount)] });
    rows.push({ v: ['Custo dos produtos', brl(st.cost)] });
    rows.push({ v: ['LUCRO BRUTO', brl(st.profit)] });
    rows.push({ v: ['Vendas canceladas', String(st.voided.length)] });
    ui.showImage(
      makeImage('Fechamento', label, [{ label: 'Forma de pagamento', x: 0, w: 520 }, { label: 'Valor', x: 820, right: true }], rows, 'Sem vendas no período.'),
      'fechamento',
    );
  }

  function imgTop() {
    const rows = st.top.slice(0, 15).map((t, i) => ({ v: [`${i + 1}. ${t.name}`, qtyTxt(t), brl(t.total)] }));
    ui.showImage(
      makeImage('Mais vendidos', label, [{ label: 'Item', x: 0, w: 420 }, { label: 'Qtd', x: 640, right: true }, { label: 'Valor', x: 820, right: true }], rows, 'Sem vendas no período.'),
      'mais-vendidos',
    );
  }

  function imgDias() {
    const rows = st.dias.map((d) => ({ v: [d.k, d.n + ' vendas', brl(d.total)] }));
    if (rows.length) rows.push({ v: ['TOTAL', st.sales.length + ' vendas', brl(st.total)] });
    ui.showImage(
      makeImage('Vendas por dia', label, [{ label: 'Dia', x: 0, w: 300 }, { label: 'Vendas', x: 640, right: true }, { label: 'Total', x: 820, right: true }], rows, 'Sem vendas no período.'),
      'vendas-por-dia',
    );
  }

  return (
    <>
      <div className="card">
        <h2>Período</h2>
        <div className="row">
          <div>
            <label>Ver vendas de</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
              {(Object.keys(PERIOD_NAMES) as Period[]).map((p) => <option key={p} value={p}>{PERIOD_NAMES[p]}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 10, fontSize: 17 }}>
          <b>{st.sales.length}</b> venda(s) · Total <b>{brl(st.total)}</b>
          {st.sales.length > 0 && <> · Ticket médio <b>{brl(st.total / st.sales.length)}</b></>}
          <br />
          {Object.entries(st.por).map(([k, v]) => `${k}: ${brl(v)}`).join(' · ') || 'Nenhuma venda no período.'}
        </div>
        <table className="res" style={{ marginTop: 12 }}>
          <tbody>
            <tr><td>Custo dos produtos vendidos</td><td className="r">{brl(st.cost)}</td></tr>
            <tr>
              <td><b>Lucro bruto</b>{st.total > 0 && <span className="hint"> ({Math.round((st.profit / st.total) * 100)}% de margem)</span>}</td>
              <td className={'r ' + (st.profit >= 0 ? 'good' : 'bad-t')}>{brl(st.profit)}</td>
            </tr>
            <tr><td>Descontos e cortesias dados</td><td className="r">{brl(st.discount)}</td></tr>
            <tr><td>Vendas canceladas</td><td className="r">{st.voided.length}{st.voided.length > 0 && ' (' + brl(st.voidedTotal) + ')'}</td></tr>
          </tbody>
        </table>
        {st.semCusto > 0 && (
          <p className="hint">
            ⚠️ {st.semCusto} item(ns) vendido(s) sem custo cadastrado: o lucro pode estar maior que o real. Informe o custo em “Produtos e preços”.
          </p>
        )}
      </div>

      <div className="card">
        <h2>Imagens para compartilhar</h2>
        <div className="row">
          <button onClick={imgEstoque}>🖼️ O que tem no estoque</button>
          <button onClick={imgCompras}>🖼️ O que falta comprar</button>
          <button onClick={imgPeriodo}>🖼️ Fechamento do período</button>
          <button onClick={imgTop}>🖼️ Mais vendidos</button>
          <button onClick={imgDias}>🖼️ Vendas por dia</button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Mais vendidos</h2>
          <table>
            <thead><tr><th>Item</th><th className="r">Qtd</th><th className="r">Valor</th></tr></thead>
            <tbody>
              {st.top.length === 0 && <tr><td colSpan={3} className="hint">Sem vendas.</td></tr>}
              {st.top.slice(0, 20).map((t, i) => (
                <tr key={t.name}><td>{i + 1}. {t.name}</td><td className="r">{qtyTxt(t)}</td><td className="r">{brl(t.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Vendas por dia</h2>
          <table>
            <thead><tr><th>Dia</th><th className="r">Vendas</th><th className="r">Total</th></tr></thead>
            <tbody>
              {st.dias.length === 0 && <tr><td colSpan={3} className="hint">Sem vendas.</td></tr>}
              {st.dias.map((d) => (
                <tr key={d.k}><td>{d.k}</td><td className="r">{d.n}</td><td className="r">{brl(d.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Caixas fechados</h2>
        <table>
          <thead><tr><th>Aberto</th><th>Fechado</th><th className="r">Vendas</th><th className="r">Diferença</th><th></th></tr></thead>
          <tbody>
            {closed.length === 0 && <tr><td colSpan={5} className="hint">Nenhum caixa fechado ainda.</td></tr>}
            {closed.map((c) => {
              const sm = cashSummary(c, db.sales);
              const diff = round2((c.counted ?? 0) - sm.expected);
              return (
                <tr key={c.id}>
                  <td>{fdt(c.openedAt)}</td>
                  <td>{c.closedAt ? fdt(c.closedAt) : ''}</td>
                  <td className="r">{brl(sm.tot)}</td>
                  <td className={'r ' + (diff !== 0 ? 'low' : '')}>{diff === 0 ? 'bateu' : (diff > 0 ? '+' : '') + brl(diff)}</td>
                  <td>
                    <button className="sec" onClick={() => { const i = cashImage(c, db.sales); ui.showImage(i.url, i.name); }}>Imagem</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Todas as vendas do período</h2>
        <table>
          <thead><tr><th>Data/hora</th><th>Itens</th><th>Pgto</th><th className="r">Desc.</th><th className="r">Total</th></tr></thead>
          <tbody>
            {st.all.length === 0 && <tr><td colSpan={5} className="hint">Nenhuma venda no período.</td></tr>}
            {[...st.all].reverse().slice(0, 300).map((x) => (
              <tr key={x.id} className={x.voidedAt ? 'cancelled' : ''}>
                <td>{fdt(x.date)}</td>
                <td>
                  {x.items.map((i) => i.name).join(', ')}
                  {x.voidedAt && <span className="hint"> (cancelada{x.voidReason ? ': ' + x.voidReason : ''})</span>}
                </td>
                <td>{x.total === 0 && x.discount > 0 ? '🎁 Cortesia' : x.pay}</td>
                <td className="r">{x.discount > 0 ? brl(x.discount) : '-'}</td>
                <td className="r">{brl(x.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
