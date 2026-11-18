import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreProvider';
import { useUI } from '../ui/UIProvider';
import { makeImage } from '../lib/reportImage';
import { computeStats, periodRange } from '../lib/stats';
import { brl, fdate, parseLocalDate, round2, todayLocal } from '../lib/format';
import { EXPENSE_CATEGORIES } from '../types';

type MonthPeriod = 'mes' | 'mesant';
const NAMES: Record<MonthPeriod, string> = { mes: 'Este mês', mesant: 'Mês passado' };

export default function Despesas() {
  const { db, addExpense, deleteExpense } = useStore();
  const ui = useUI();
  const [period, setPeriod] = useState<MonthPeriod>('mes');
  const [date, setDate] = useState(todayLocal());
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');

  const st = useMemo(() => computeStats(db.sales, period), [db.sales, period]);
  const [from, to] = periodRange(period);

  const list = useMemo(
    () =>
      db.expenses
        .filter((e) => {
          const d = parseLocalDate(e.date);
          return d >= from && d < to;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.expenses, period],
  );

  const totalDesp = round2(list.reduce((a, e) => a + e.amount, 0));
  const byCat: Record<string, number> = {};
  list.forEach((e) => {
    byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const resultado = round2(st.profit - totalDesp);

  async function add() {
    const v = parseFloat(amount);
    if (!(v > 0)) return ui.toast('Informe o valor da despesa.');
    if (!date) return ui.toast('Informe a data.');
    await addExpense({ date, category, description: desc.trim(), amount: v });
    setDesc('');
    setAmount('');
    ui.toast('Despesa lançada.');
  }

  async function remove(id: string) {
    if (await ui.confirm('Apagar esta despesa?')) await deleteExpense(id);
  }

  function imagem() {
    const rows = [
      { v: ['Vendas (já com descontos)', brl(st.total)] },
      { v: ['Custo dos produtos', '− ' + brl(st.cost)] },
      { v: ['LUCRO BRUTO', brl(st.profit)] },
      { v: ['Despesas', '− ' + brl(totalDesp)] },
      ...cats.map(([c, v]) => ({ v: ['     • ' + c, brl(v)] })),
      { alert: resultado < 0, v: ['RESULTADO DO PERÍODO', brl(resultado)] },
    ];
    ui.showImage(
      makeImage(
        'Resultado do mês',
        NAMES[period] + ' · ' + from.toLocaleDateString('pt-BR') + ' a ' + new Date(to.getTime() - 1).toLocaleDateString('pt-BR'),
        [{ label: 'Descrição', x: 0, w: 520 }, { label: 'Valor', x: 820, right: true }],
        rows,
        '',
      ),
      'resultado-' + period,
    );
  }

  return (
    <>
      <div className="card">
        <h2>Lançar despesa</h2>
        <div className="row">
          <div>
            <label>Data</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label>Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <label>Descrição</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="ex.: Conta de luz de outubro" />
          </div>
          <div>
            <label>Valor (R$)</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <button onClick={() => void add()}>Lançar</button>
        </div>
      </div>

      <div className="card">
        <h2>Resultado</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <div>
            <label>Período</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as MonthPeriod)}>
              {(Object.keys(NAMES) as MonthPeriod[]).map((p) => <option key={p} value={p}>{NAMES[p]}</option>)}
            </select>
          </div>
        </div>
        <table className="res">
          <tbody>
            <tr><td>Vendas (já com descontos)</td><td className="r">{brl(st.total)}</td></tr>
            <tr><td>Custo dos produtos vendidos</td><td className="r">− {brl(st.cost)}</td></tr>
            <tr><td><b>Lucro bruto</b></td><td className="r"><b>{brl(st.profit)}</b></td></tr>
            <tr><td>Despesas</td><td className="r">− {brl(totalDesp)}</td></tr>
            <tr className="big">
              <td>Resultado</td>
              <td className={'r ' + (resultado >= 0 ? 'good' : 'bad-t')}>{brl(resultado)}</td>
            </tr>
          </tbody>
        </table>
        {st.semCusto > 0 && (
          <p className="hint">
            ⚠️ {st.semCusto} item(ns) vendido(s) sem custo cadastrado. O lucro pode estar maior que o real: informe o custo em
            “Produtos e preços”.
          </p>
        )}
        <p className="hint">O custo só vale para vendas feitas depois de cadastrar o custo do produto.</p>
        <button style={{ marginTop: 6 }} onClick={imagem}>🖼️ Gerar imagem: Resultado do mês</button>
      </div>

      <div className="grid">
        <div className="card">
          <h2>Despesas por categoria</h2>
          <table>
            <thead><tr><th>Categoria</th><th className="r">Total</th></tr></thead>
            <tbody>
              {cats.length === 0 && <tr><td colSpan={2} className="hint">Nenhuma despesa no período.</td></tr>}
              {cats.map(([c, v]) => <tr key={c}><td>{c}</td><td className="r">{brl(v)}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Despesas lançadas</h2>
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th className="r">Valor</th><th></th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={4} className="hint">Nenhuma despesa no período.</td></tr>}
              {list.map((e) => (
                <tr key={e.id}>
                  <td>{fdate(e.date)}</td>
                  <td>{e.category}{e.description ? ' – ' + e.description : ''}</td>
                  <td className="r">{brl(e.amount)}</td>
                  <td><button className="x" onClick={() => void remove(e.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
