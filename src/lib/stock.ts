import type { StockItem } from '../types';
import { num } from './format';

export const isLow = (s: StockItem): boolean => s.qty <= 0 || (s.min > 0 && s.qty <= s.min);

export interface LowItem {
  name: string;
  need: string;
}

/** Itens do estoque que acabaram ou chegaram no mínimo (entram sozinhos na lista de compras). */
export function lowItems(stock: StockItem[]): LowItem[] {
  return stock.filter(isLow).map((s) => ({
    name: s.name,
    need: s.qty <= 0 ? 'ACABOU – comprar' : `repor (tem ${num(s.qty)} ${s.unit}, mínimo ${num(s.min)})`,
  }));
}
