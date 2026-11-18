export type TabId = 'caixa' | 'estoque' | 'compras' | 'produtos' | 'despesas' | 'relatorios';
export type PayMethod = 'Dinheiro' | 'Pix' | 'Cartão';
export type WeightUnit = 'kg' | 'g';

export interface Settings {
  pricePerKg: number;
  /** Quanto você paga por kg de açaí (para calcular o lucro). */
  acaiCostPerKg: number;
  baud: number;
  unit: WeightUnit;
  acaiStockId: string | null;
  passHash: string;
  lockedTabs: TabId[];
  /** Baixa uma cópia dos dados sozinho ao fechar o caixa. */
  autoBackup: boolean;
  lastBackupAt: string | null;
}

export interface StockItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  min: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  /** Quanto custa 1 unidade para você (para calcular o lucro). */
  cost: number;
  stockId: string | null;
}

export interface ShoppingItem {
  id: string;
  name: string;
  need: string;
  done: boolean;
}

export interface SaleItem {
  kind: 'peso' | 'un';
  name: string;
  qty: number;
  /** Valor da linha antes do desconto. */
  total: number;
  /** Custo da linha (quantidade x custo unitário). */
  cost: number;
  /** Item do estoque que foi baixado (para devolver se a venda for cancelada). */
  stockId: string | null;
}

export interface Sale {
  id: string;
  cashId: string | null;
  date: string;
  items: SaleItem[];
  /** Soma dos itens, antes do desconto. */
  subtotal: number;
  /** Desconto em R$ (numa cortesia, é igual ao subtotal). */
  discount: number;
  /** Valor final cobrado (subtotal - desconto). */
  total: number;
  /** Custo total dos itens vendidos. */
  cost: number;
  pay: PayMethod;
  received: number;
  voidedAt: string | null;
  voidReason: string;
}

export interface CashMove {
  type: 'in' | 'out';
  amount: number;
  note: string;
  at: string;
}

/** Um "caixa do dia". Aberto enquanto closedAt for null. */
export interface CashSession {
  id: string;
  openedAt: string;
  opening: number;
  moves: CashMove[];
  closedAt: string | null;
  counted: number | null;
}

export const EXPENSE_CATEGORIES = ['Aluguel', 'Energia e água', 'Fornecedores', 'Funcionários', 'Outros'] as const;

export interface Expense {
  id: string;
  /** Data no formato AAAA-MM-DD. */
  date: string;
  category: string;
  description: string;
  amount: number;
}

export interface DB {
  settings: Settings;
  stock: StockItem[];
  products: Product[];
  shopping: ShoppingItem[];
  sales: Sale[];
  cash: CashSession[];
  expenses: Expense[];
}
