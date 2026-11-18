import type { Sale } from '../types';
import { round2 } from './format';

export type Period = 'hoje' | 'sem' | 'mes' | 'mesant';

export const PERIOD_NAMES: Record<Period, string> = {
  hoje: 'Hoje',
  sem: 'Últimos 7 dias',
  mes: 'Este mês',
  mesant: 'Mês passado',
};

const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export function periodRange(p: Period): [Date, Date] {
  const n = new Date();
  const t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  if (p === 'hoje') return [t0, addDays(t0, 1)];
  if (p === 'sem') return [addDays(t0, -6), addDays(t0, 1)];
  if (p === 'mes') return [new Date(n.getFullYear(), n.getMonth(), 1), new Date(n.getFullYear(), n.getMonth() + 1, 1)];
  return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 1)];
}

export interface DayStat {
  k: string;
  ts: number;
  n: number;
  total: number;
}

export interface TopStat {
  name: string;
  kind: 'peso' | 'un';
  qty: number;
  total: number;
}

export interface Stats {
  /** Todas as vendas do período, inclusive as canceladas. */
  all: Sale[];
  /** Só as vendas válidas (não canceladas). */
  sales: Sale[];
  voided: Sale[];
  voidedTotal: number;
  /** Valor vendido, já com os descontos. */
  total: number;
  discount: number;
  cost: number;
  profit: number;
  /** Quantidade de itens vendidos sem custo cadastrado (o lucro fica maior que o real). */
  semCusto: number;
  por: Record<string, number>;
  dias: DayStat[];
  top: TopStat[];
}

export function computeStats(allSales: Sale[], p: Period): Stats {
  const [a, b] = periodRange(p);
  const all = allSales.filter((s) => {
    const d = new Date(s.date);
    return d >= a && d < b;
  });
  const sales = all.filter((s) => !s.voidedAt);
  const voided = all.filter((s) => s.voidedAt);

  const por: Record<string, number> = {};
  const dias: Record<string, DayStat> = {};
  const top: Record<string, TopStat> = {};
  let total = 0;
  let discount = 0;
  let cost = 0;
  let semCusto = 0;

  sales.forEach((s) => {
    total += s.total;
    discount += s.discount;
    cost += s.cost;
    if (s.total > 0) por[s.pay] = (por[s.pay] || 0) + s.total;
    const dt = new Date(s.date);
    const k = dt.toLocaleDateString('pt-BR');
    const dd = dias[k] ?? (dias[k] = { k, ts: new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime(), n: 0, total: 0 });
    dd.n++;
    dd.total += s.total;
    s.items.forEach((i) => {
      if (i.cost <= 0) semCusto++;
      const name = i.kind === 'peso' ? 'Açaí (por peso)' : i.name;
      const t = top[name] ?? (top[name] = { name, kind: i.kind, qty: 0, total: 0 });
      t.qty += i.qty;
      t.total += i.total;
    });
  });

  total = round2(total);
  cost = round2(cost);
  return {
    all,
    sales,
    voided,
    voidedTotal: round2(voided.reduce((x, s) => x + s.total, 0)),
    total,
    discount: round2(discount),
    cost,
    profit: round2(total - cost),
    semCusto,
    por,
    dias: Object.values(dias).sort((x, y) => x.ts - y.ts),
    top: Object.values(top).sort((x, y) => y.total - x.total),
  };
}
