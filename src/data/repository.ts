import type { CashSession, DB, Expense, Product, Sale, Settings, ShoppingItem, StockItem } from '../types';

/**
 * Tudo que o sistema precisa do banco de dados.
 * Existem duas versões: LocalRepository (navegador) e SupabaseRepository (nuvem).
 * Para trocar de banco, só mudam as variáveis em .env.local (veja src/data/index.ts).
 */
export interface Repository {
  loadAll(): Promise<DB>;
  saveSettings(s: Settings): Promise<void>;
  upsertStockItem(i: StockItem): Promise<void>;
  deleteStockItem(id: string): Promise<void>;
  upsertProduct(p: Product): Promise<void>;
  deleteProduct(id: string): Promise<void>;
  upsertShoppingItem(i: ShoppingItem): Promise<void>;
  deleteShoppingItem(id: string): Promise<void>;
  /** Grava uma venda nova ou atualiza uma existente (ex.: cancelamento). */
  upsertSale(s: Sale): Promise<void>;
  upsertCashSession(c: CashSession): Promise<void>;
  upsertExpense(e: Expense): Promise<void>;
  deleteExpense(id: string): Promise<void>;
  /** Substitui todos os dados (usado ao restaurar um backup). */
  importAll(db: DB): Promise<void>;
}
