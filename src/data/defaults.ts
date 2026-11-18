import type { DB, Sale, SaleItem, Settings } from '../types';

export const defaultSettings: Settings = {
  pricePerKg: 49.9,
  acaiCostPerKg: 0,
  baud: 9600,
  unit: 'kg',
  acaiStockId: null,
  passHash: '',
  lockedTabs: ['relatorios', 'produtos', 'despesas'],
  autoBackup: true,
  lastBackupAt: null,
};

export const emptyDB = (): DB => ({
  settings: { ...defaultSettings, lockedTabs: [...defaultSettings.lockedTabs] },
  stock: [],
  products: [],
  shopping: [],
  sales: [],
  cash: [],
  expenses: [],
});

const num = (v: unknown): number => Number(v) || 0;

/** Completa os campos novos em vendas gravadas por versões anteriores. */
function normalizeSale(raw: Partial<Sale> & { id: string }): Sale {
  const total = num(raw.total);
  const items: SaleItem[] = (raw.items ?? []).map((i) => ({
    kind: i.kind,
    name: i.name,
    qty: num(i.qty),
    total: num(i.total),
    cost: num(i.cost),
    stockId: i.stockId ?? null,
  }));
  return {
    id: raw.id,
    cashId: raw.cashId ?? null,
    date: String(raw.date),
    items,
    subtotal: typeof raw.subtotal === 'number' ? raw.subtotal : total,
    discount: num(raw.discount),
    total,
    cost: num(raw.cost),
    pay: raw.pay ?? 'Dinheiro',
    received: num(raw.received),
    voidedAt: raw.voidedAt ?? null,
    voidReason: raw.voidReason ?? '',
  };
}

/**
 * Garante que os dados têm todos os campos da versão atual
 * (usado ao ler o armazenamento do navegador e ao restaurar backups antigos).
 */
export function normalizeDB(d: Partial<DB>): DB {
  const base = emptyDB();
  const rawSettings = (d.settings ?? {}) as Partial<Settings>;
  const legacy = !('autoBackup' in rawSettings);
  const settings: Settings = { ...base.settings, ...rawSettings };
  settings.lockedTabs = Array.isArray(settings.lockedTabs) ? [...settings.lockedTabs] : [];
  // Dados de versões antigas: se Relatórios já era protegido, Despesas também passa a ser.
  if (legacy && settings.lockedTabs.includes('relatorios') && !settings.lockedTabs.includes('despesas')) {
    settings.lockedTabs.push('despesas');
  }
  return {
    settings,
    stock: d.stock ?? [],
    products: (d.products ?? []).map((p) => ({ ...p, cost: num(p.cost), stockId: p.stockId ?? null })),
    shopping: d.shopping ?? [],
    sales: (d.sales ?? []).map(normalizeSale),
    cash: d.cash ?? [],
    expenses: d.expenses ?? [],
  };
}
