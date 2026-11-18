import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CashMove,
  CashSession,
  DB,
  Expense,
  PayMethod,
  Product,
  Sale,
  SaleItem,
  Settings,
  ShoppingItem,
  StockItem,
  TabId,
} from '../types';
import { defaultSettings } from './defaults';
import type { Repository } from './repository';

type Row = Record<string, unknown>;
interface Err {
  message: string;
}

const ck = (r: { error: Err | null }): void => {
  if (r.error) throw new Error(r.error.message);
};
const n = (v: unknown): number => Number(v) || 0;
const NONE = '00000000-0000-0000-0000-000000000000';

/* ---- conversões entre o formato do sistema e as colunas do banco ---- */
const settingsToRow = (s: Settings): Row => ({
  id: 1,
  price_per_kg: s.pricePerKg,
  acai_cost_per_kg: s.acaiCostPerKg,
  baud: s.baud,
  unit: s.unit,
  acai_stock_id: s.acaiStockId,
  pass_hash: s.passHash,
  locked_tabs: s.lockedTabs,
  auto_backup: s.autoBackup,
  last_backup_at: s.lastBackupAt,
});
const settingsFromRow = (r: Row): Settings => ({
  pricePerKg: n(r.price_per_kg),
  acaiCostPerKg: n(r.acai_cost_per_kg),
  baud: n(r.baud) || 9600,
  unit: r.unit === 'g' ? 'g' : 'kg',
  acaiStockId: (r.acai_stock_id as string | null) ?? null,
  passHash: String(r.pass_hash ?? ''),
  lockedTabs: (r.locked_tabs as TabId[] | null) ?? [],
  autoBackup: r.auto_backup === undefined || r.auto_backup === null ? true : Boolean(r.auto_backup),
  lastBackupAt: (r.last_backup_at as string | null) ?? null,
});

const stockToRow = (s: StockItem): Row => ({ id: s.id, name: s.name, qty: s.qty, unit: s.unit, min_qty: s.min });
const stockFromRow = (r: Row): StockItem => ({
  id: String(r.id),
  name: String(r.name),
  qty: n(r.qty),
  unit: String(r.unit ?? 'un'),
  min: n(r.min_qty),
});

const productToRow = (p: Product): Row => ({ id: p.id, name: p.name, price: p.price, cost: p.cost, stock_id: p.stockId });
const productFromRow = (r: Row): Product => ({
  id: String(r.id),
  name: String(r.name),
  price: n(r.price),
  cost: n(r.cost),
  stockId: (r.stock_id as string | null) ?? null,
});

const shoppingToRow = (s: ShoppingItem): Row => ({ id: s.id, name: s.name, need: s.need, done: s.done });
const shoppingFromRow = (r: Row): ShoppingItem => ({
  id: String(r.id),
  name: String(r.name),
  need: String(r.need ?? ''),
  done: Boolean(r.done),
});

const cashToRow = (c: CashSession): Row => ({
  id: c.id,
  opened_at: c.openedAt,
  opening: c.opening,
  moves: c.moves,
  closed_at: c.closedAt,
  counted: c.counted,
});
const cashFromRow = (r: Row): CashSession => ({
  id: String(r.id),
  openedAt: String(r.opened_at),
  opening: n(r.opening),
  moves: (r.moves as CashMove[] | null) ?? [],
  closedAt: (r.closed_at as string | null) ?? null,
  counted: r.counted === null || r.counted === undefined ? null : n(r.counted),
});

const saleToRow = (s: Sale): Row => ({
  id: s.id,
  cash_id: s.cashId,
  sold_at: s.date,
  items: s.items,
  subtotal: s.subtotal,
  discount: s.discount,
  total: s.total,
  cost: s.cost,
  pay: s.pay,
  received: s.received,
  voided_at: s.voidedAt,
  void_reason: s.voidReason,
});
const saleFromRow = (r: Row): Sale => {
  const total = n(r.total);
  const items = ((r.items as Partial<SaleItem>[] | null) ?? []).map((i) => ({
    kind: i.kind === 'peso' ? ('peso' as const) : ('un' as const),
    name: String(i.name ?? ''),
    qty: n(i.qty),
    total: n(i.total),
    cost: n(i.cost),
    stockId: i.stockId ?? null,
  }));
  return {
    id: String(r.id),
    cashId: (r.cash_id as string | null) ?? null,
    date: String(r.sold_at),
    items,
    subtotal: r.subtotal === null || r.subtotal === undefined ? total : n(r.subtotal),
    discount: n(r.discount),
    total,
    cost: n(r.cost),
    pay: r.pay as PayMethod,
    received: n(r.received),
    voidedAt: (r.voided_at as string | null) ?? null,
    voidReason: String(r.void_reason ?? ''),
  };
};

const expenseToRow = (e: Expense): Row => ({
  id: e.id,
  spent_on: e.date,
  category: e.category,
  description: e.description,
  amount: e.amount,
});
const expenseFromRow = (r: Row): Expense => ({
  id: String(r.id),
  date: String(r.spent_on).slice(0, 10),
  category: String(r.category ?? 'Outros'),
  description: String(r.description ?? ''),
  amount: n(r.amount),
});

export class SupabaseRepository implements Repository {
  private sb: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.sb = client;
  }

  /** Busca todas as linhas de uma tabela (o Supabase entrega no máximo 1000 por vez). */
  private async all(table: string, orderBy: string): Promise<Row[]> {
    const out: Row[] = [];
    const size = 1000;
    for (let from = 0; ; from += size) {
      const { data, error } = await this.sb
        .from(table)
        .select('*')
        .order(orderBy, { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + size - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Row[];
      out.push(...rows);
      if (rows.length < size) break;
    }
    return out;
  }

  async loadAll(): Promise<DB> {
    const sr = await this.sb.from('settings').select('*').eq('id', 1).maybeSingle();
    ck(sr);
    let settings: Settings = { ...defaultSettings, lockedTabs: [...defaultSettings.lockedTabs] };
    if (sr.data) {
      settings = settingsFromRow(sr.data as Row);
    } else {
      ck(await this.sb.from('settings').upsert(settingsToRow(settings)));
    }
    const [stock, products, shopping, cash, sales, expenses] = await Promise.all([
      this.all('stock_items', 'created_at'),
      this.all('products', 'created_at'),
      this.all('shopping_items', 'created_at'),
      this.all('cash_sessions', 'opened_at'),
      this.all('sales', 'sold_at'),
      this.all('expenses', 'spent_on'),
    ]);
    return {
      settings,
      stock: stock.map(stockFromRow),
      products: products.map(productFromRow),
      shopping: shopping.map(shoppingFromRow),
      cash: cash.map(cashFromRow),
      sales: sales.map(saleFromRow),
      expenses: expenses.map(expenseFromRow),
    };
  }

  async saveSettings(s: Settings): Promise<void> {
    ck(await this.sb.from('settings').upsert(settingsToRow(s)));
  }

  async upsertStockItem(i: StockItem): Promise<void> {
    ck(await this.sb.from('stock_items').upsert(stockToRow(i)));
  }

  async deleteStockItem(id: string): Promise<void> {
    ck(await this.sb.from('stock_items').delete().eq('id', id));
  }

  async upsertProduct(p: Product): Promise<void> {
    ck(await this.sb.from('products').upsert(productToRow(p)));
  }

  async deleteProduct(id: string): Promise<void> {
    ck(await this.sb.from('products').delete().eq('id', id));
  }

  async upsertShoppingItem(i: ShoppingItem): Promise<void> {
    ck(await this.sb.from('shopping_items').upsert(shoppingToRow(i)));
  }

  async deleteShoppingItem(id: string): Promise<void> {
    ck(await this.sb.from('shopping_items').delete().eq('id', id));
  }

  async upsertSale(s: Sale): Promise<void> {
    ck(await this.sb.from('sales').upsert(saleToRow(s)));
  }

  async upsertCashSession(c: CashSession): Promise<void> {
    ck(await this.sb.from('cash_sessions').upsert(cashToRow(c)));
  }

  async upsertExpense(e: Expense): Promise<void> {
    ck(await this.sb.from('expenses').upsert(expenseToRow(e)));
  }

  async deleteExpense(id: string): Promise<void> {
    ck(await this.sb.from('expenses').delete().eq('id', id));
  }

  async importAll(db: DB): Promise<void> {
    for (const t of ['sales', 'cash_sessions', 'products', 'shopping_items', 'expenses', 'stock_items']) {
      ck(await this.sb.from(t).delete().neq('id', NONE));
    }
    const chunk = async (table: string, rows: Row[]): Promise<void> => {
      for (let i = 0; i < rows.length; i += 500) {
        ck(await this.sb.from(table).insert(rows.slice(i, i + 500)));
      }
    };
    await chunk('stock_items', db.stock.map(stockToRow));
    await chunk('products', db.products.map(productToRow));
    await chunk('shopping_items', db.shopping.map(shoppingToRow));
    await chunk('cash_sessions', db.cash.map(cashToRow));
    await chunk('sales', db.sales.map(saleToRow));
    await chunk('expenses', db.expenses.map(expenseToRow));
    ck(await this.sb.from('settings').upsert(settingsToRow(db.settings)));
  }
}
