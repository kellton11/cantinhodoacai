import type { CashSession, PayMethod, Sale } from '../types';
import { brl, fdt, round2 } from './format';
import { makeImage } from './reportImage';

export interface CashSummary {
  /** Vendas válidas (sem as canceladas). */
  n: number;
  nVoid: number;
  por: Record<PayMethod, number>;
  tot: number;
  /** Total de descontos e cortesias dados. */
  disc: number;
  sup: number;
  san: number;
  expected: number;
}

export function cashSummary(c: CashSession, sales: Sale[]): CashSummary {
  const all = sales.filter((s) => s.cashId === c.id);
  const mine = all.filter((s) => !s.voidedAt);
  const por: Record<PayMethod, number> = { Dinheiro: 0, Pix: 0, Cartão: 0 };
  mine.forEach((s) => {
    por[s.pay] = (por[s.pay] || 0) + s.total;
  });
  const tot = round2(mine.reduce((a, s) => a + s.total, 0));
  const disc = round2(mine.reduce((a, s) => a + s.discount, 0));
  const sup = c.moves.filter((m) => m.type === 'in').reduce((a, m) => a + m.amount, 0);
  const san = c.moves.filter((m) => m.type === 'out').reduce((a, m) => a + m.amount, 0);
  return {
    n: mine.length,
    nVoid: all.length - mine.length,
    por,
    tot,
    disc,
    sup,
    san,
    expected: round2(c.opening + por.Dinheiro + sup - san),
  };
}

/** Imagem do fechamento de um caixa já fechado. */
export function cashImage(c: CashSession, sales: Sale[]): { url: string; name: string } {
  const sm = cashSummary(c, sales);
  const counted = c.counted ?? 0;
  const diff = round2(counted - sm.expected);
  const rows = [
    { v: ['Troco inicial', brl(c.opening)] },
    { v: ['Vendas em dinheiro', brl(sm.por.Dinheiro)] },
    { v: ['Vendas no Pix', brl(sm.por.Pix)] },
    { v: ['Vendas no cartão', brl(sm.por['Cartão'])] },
    { v: [`TOTAL VENDIDO (${sm.n} vendas)`, brl(sm.tot)] },
    { v: ['Descontos e cortesias dados', brl(sm.disc)] },
    { v: ['Vendas canceladas', String(sm.nVoid)] },
    { v: ['Entradas', brl(sm.sup)] },
    { v: ['Retiradas', brl(sm.san)] },
    { v: ['Dinheiro esperado', brl(sm.expected)] },
    { v: ['Dinheiro contado', brl(counted)] },
    { alert: diff !== 0, v: ['Diferença', (diff > 0 ? '+' : '') + brl(diff)] },
  ];
  const url = makeImage(
    'Fechamento de caixa',
    `${fdt(c.openedAt)} até ${c.closedAt ? fdt(c.closedAt) : ''}`,
    [
      { label: 'Descrição', x: 0, w: 520 },
      { label: 'Valor', x: 820, right: true },
    ],
    rows,
    '',
  );
  return { url, name: 'fechamento-caixa-' + (c.closedAt ?? c.openedAt).slice(0, 10) };
}
