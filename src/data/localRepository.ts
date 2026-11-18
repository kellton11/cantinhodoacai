import type { CashSession, DB, Expense, Product, Sale, Settings, ShoppingItem, StockItem } from '../types';
import { emptyDB, normalizeDB } from './defaults';
import type { Repository } from './repository';

const KEY = 'cantinho_do_acai_v2';

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [...list, item];
  const copy = [...list];
  copy[i] = item;
  return copy;
}

/** Guarda tudo no navegador deste computador (localStorage). */
export class LocalRepository implements Repository {
  private db: DB;

  constructor() {
    this.db = this.read();
  }

  private read(): DB {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalizeDB(JSON.parse(raw) as Partial<DB>);
    } catch {
      /* dados corrompidos: começa vazio */
    }
    return emptyDB();
  }

  private write(): void {
    localStorage.setItem(KEY, JSON.stringify(this.db));
  }

  async loadAll(): Promise<DB> {
    return JSON.parse(JSON.stringify(this.db)) as DB;
  }

  async saveSettings(s: Settings): Promise<void> {
    this.db.settings = s;
    this.write();
  }

  async upsertStockItem(i: StockItem): Promise<void> {
    this.db.stock = upsert(this.db.stock, i);
    this.write();
  }

  async deleteStockItem(id: string): Promise<void> {
    this.db.stock = this.db.stock.filter((x) => x.id !== id);
    this.write();
  }

  async upsertProduct(p: Product): Promise<void> {
    this.db.products = upsert(this.db.products, p);
    this.write();
  }

  async deleteProduct(id: string): Promise<void> {
    this.db.products = this.db.products.filter((x) => x.id !== id);
    this.write();
  }

  async upsertShoppingItem(i: ShoppingItem): Promise<void> {
    this.db.shopping = upsert(this.db.shopping, i);
    this.write();
  }

  async deleteShoppingItem(id: string): Promise<void> {
    this.db.shopping = this.db.shopping.filter((x) => x.id !== id);
    this.write();
  }

  async upsertSale(s: Sale): Promise<void> {
    this.db.sales = upsert(this.db.sales, s);
    this.write();
  }

  async upsertCashSession(c: CashSession): Promise<void> {
    this.db.cash = upsert(this.db.cash, c);
    this.write();
  }

  async upsertExpense(e: Expense): Promise<void> {
    this.db.expenses = upsert(this.db.expenses, e);
    this.write();
  }

  async deleteExpense(id: string): Promise<void> {
    this.db.expenses = this.db.expenses.filter((x) => x.id !== id);
    this.write();
  }

  async importAll(db: DB): Promise<void> {
    this.db = JSON.parse(JSON.stringify(db)) as DB;
    this.write();
  }
}
