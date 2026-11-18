import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { repo } from '../data';
import { emptyDB } from '../data/defaults';
import { downloadBackupFile, parseBackup } from '../lib/backup';
import { round2, uid } from '../lib/format';
import { useUI } from '../ui/UIProvider';
import type { CashSession, DB, Expense, PayMethod, Product, Sale, Settings, StockItem } from '../types';

export interface CartItem {
  key: string;
  kind: 'peso' | 'un';
  pid?: string;
  name: string;
  /** kg para o açaí, unidades para os demais. */
  qty: number;
  /** Valor da linha (antes do desconto). */
  total: number;
  /** Custo por kg (açaí) ou por unidade. */
  unitCost: number;
  stockId: string | null;
}

export interface Store {
  db: DB;
  loading: boolean;
  openSession: CashSession | null;
  setSettings: (patch: Partial<Settings>) => Promise<void>;
  addStock: (i: Omit<StockItem, 'id'>) => Promise<void>;
  setStockQty: (id: string, qty: number) => Promise<void>;
  deleteStock: (id: string) => Promise<void>;
  addProduct: (p: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, patch: Partial<Omit<Product, 'id'>>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addShopping: (name: string, need: string) => Promise<void>;
  toggleShopping: (id: string) => Promise<void>;
  deleteShopping: (id: string) => Promise<void>;
  finalizeSale: (items: CartItem[], pay: PayMethod, received: number, discount: number) => Promise<Sale | null>;
  voidSale: (id: string, reason: string) => Promise<boolean>;
  openCash: (opening: number) => Promise<void>;
  addCashMove: (type: 'in' | 'out', amount: number, note: string) => Promise<void>;
  closeCash: (counted: number) => Promise<CashSession | null>;
  addExpense: (e: Omit<Expense, 'id'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  /** Baixa o arquivo de backup e anota a data do último backup. */
  runBackup: () => Promise<void>;
  importBackup: (text: string) => Promise<boolean>;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore fora do StoreProvider');
  return ctx;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const ui = useUI();
  const dbRef = useRef<DB>(emptyDB());
  const [db, setDb] = useState<DB>(dbRef.current);
  const [loading, setLoading] = useState(true);

  const commit = (next: DB): void => {
    dbRef.current = next;
    setDb(next);
  };

  useEffect(() => {
    let alive = true;
    repo
      .loadAll()
      .then((d) => {
        if (alive) commit(d);
      })
      .catch((e: unknown) => ui.toast('Erro ao carregar os dados: ' + (e instanceof Error ? e.message : String(e))))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const actions = useMemo(() => {
    /** Grava no banco; se der erro, avisa e recarrega o que está salvo. */
    const persist = async (fn: () => Promise<unknown>): Promise<boolean> => {
      try {
        await fn();
        return true;
      } catch (e) {
        ui.toast('Erro ao salvar: ' + (e instanceof Error ? e.message : String(e)));
        try {
          commit(await repo.loadAll());
        } catch {
          /* mantém o que está na tela */
        }
        return false;
      }
    };

    const findOpen = (d: DB): CashSession | undefined => d.cash.find((c) => c.closedAt === null);

    const setSettings: Store['setSettings'] = async (patch) => {
      const next = { ...dbRef.current.settings, ...patch };
      commit({ ...dbRef.current, settings: next });
      await persist(() => repo.saveSettings(next));
    };

    const addStock: Store['addStock'] = async (item) => {
      const d = dbRef.current;
      const ex = d.stock.find((s) => s.name.toLowerCase() === item.name.toLowerCase());
      const saved: StockItem = ex
        ? { ...ex, qty: Math.round((ex.qty + item.qty) * 1000) / 1000, min: item.min > 0 ? item.min : ex.min }
        : { id: uid(), ...item };
      commit({ ...d, stock: ex ? d.stock.map((s) => (s.id === ex.id ? saved : s)) : [...d.stock, saved] });
      await persist(() => repo.upsertStockItem(saved));
    };

    const setStockQty: Store['setStockQty'] = async (id, qty) => {
      const d = dbRef.current;
      const s = d.stock.find((x) => x.id === id);
      if (!s) return;
      const saved = { ...s, qty: Math.max(0, qty) };
      commit({ ...d, stock: d.stock.map((x) => (x.id === id ? saved : x)) });
      await persist(() => repo.upsertStockItem(saved));
    };

    const deleteStock: Store['deleteStock'] = async (id) => {
      const d = dbRef.current;
      const products = d.products.map((p) => (p.stockId === id ? { ...p, stockId: null } : p));
      const touched = products.filter((p, i) => p !== d.products[i]);
      const settings = d.settings.acaiStockId === id ? { ...d.settings, acaiStockId: null } : d.settings;
      commit({ ...d, stock: d.stock.filter((s) => s.id !== id), products, settings });
      await persist(async () => {
        if (settings !== d.settings) await repo.saveSettings(settings);
        await Promise.all(touched.map((p) => repo.upsertProduct(p)));
        await repo.deleteStockItem(id);
      });
    };

    const addProduct: Store['addProduct'] = async (p) => {
      const saved: Product = { id: uid(), ...p };
      commit({ ...dbRef.current, products: [...dbRef.current.products, saved] });
      await persist(() => repo.upsertProduct(saved));
    };

    const updateProduct: Store['updateProduct'] = async (id, patch) => {
      const d = dbRef.current;
      const cur = d.products.find((p) => p.id === id);
      if (!cur) return;
      const saved: Product = { ...cur, ...patch };
      commit({ ...d, products: d.products.map((p) => (p.id === id ? saved : p)) });
      await persist(() => repo.upsertProduct(saved));
    };

    const deleteProduct: Store['deleteProduct'] = async (id) => {
      commit({ ...dbRef.current, products: dbRef.current.products.filter((p) => p.id !== id) });
      await persist(() => repo.deleteProduct(id));
    };

    const addShopping: Store['addShopping'] = async (name, need) => {
      const saved = { id: uid(), name, need, done: false };
      commit({ ...dbRef.current, shopping: [...dbRef.current.shopping, saved] });
      await persist(() => repo.upsertShoppingItem(saved));
    };

    const toggleShopping: Store['toggleShopping'] = async (id) => {
      const d = dbRef.current;
      const s = d.shopping.find((x) => x.id === id);
      if (!s) return;
      const saved = { ...s, done: !s.done };
      commit({ ...d, shopping: d.shopping.map((x) => (x.id === id ? saved : x)) });
      await persist(() => repo.upsertShoppingItem(saved));
    };

    const deleteShopping: Store['deleteShopping'] = async (id) => {
      commit({ ...dbRef.current, shopping: dbRef.current.shopping.filter((s) => s.id !== id) });
      await persist(() => repo.deleteShoppingItem(id));
    };

    const finalizeSale: Store['finalizeSale'] = async (items, pay, received, discount) => {
      const d = dbRef.current;
      const open = findOpen(d);
      if (!open) {
        ui.toast('Abra o caixa antes de vender.');
        return null;
      }
      const subtotal = round2(items.reduce((a, c) => a + c.total, 0));
      const disc = round2(Math.min(Math.max(discount, 0), subtotal));
      const total = round2(subtotal - disc);
      const saleItems = items.map((c) => ({
        kind: c.kind,
        name: c.name,
        qty: c.qty,
        total: c.total,
        cost: round2(c.qty * c.unitCost),
        stockId: c.stockId,
      }));
      const sale: Sale = {
        id: uid(),
        cashId: open.id,
        date: new Date().toISOString(),
        items: saleItems,
        subtotal,
        discount: disc,
        total,
        cost: round2(saleItems.reduce((a, i) => a + i.cost, 0)),
        pay,
        received: pay === 'Dinheiro' ? received : total,
        voidedAt: null,
        voidReason: '',
      };
      let stock = d.stock;
      const touched = new Map<string, StockItem>();
      for (const it of items) {
        if (!it.stockId) continue;
        const cur = stock.find((x) => x.id === it.stockId);
        if (!cur) continue;
        const upd: StockItem = { ...cur, qty: Math.max(0, Math.round((cur.qty - it.qty) * 1000) / 1000) };
        stock = stock.map((x) => (x.id === cur.id ? upd : x));
        touched.set(cur.id, upd);
      }
      commit({ ...d, stock, sales: [...d.sales, sale] });
      const ok = await persist(async () => {
        await repo.upsertSale(sale);
        await Promise.all(Array.from(touched.values()).map((s) => repo.upsertStockItem(s)));
      });
      return ok ? sale : null;
    };

    const voidSale: Store['voidSale'] = async (id, reason) => {
      const d = dbRef.current;
      const sale = d.sales.find((s) => s.id === id);
      if (!sale || sale.voidedAt) return false;
      const open = findOpen(d);
      if (!open || sale.cashId !== open.id) {
        ui.toast('Só dá para cancelar vendas do caixa que está aberto.');
        return false;
      }
      const saved: Sale = { ...sale, voidedAt: new Date().toISOString(), voidReason: reason };
      // devolve ao estoque o que foi baixado na venda
      let stock = d.stock;
      const touched = new Map<string, StockItem>();
      for (const it of sale.items) {
        if (!it.stockId) continue;
        const cur = stock.find((x) => x.id === it.stockId);
        if (!cur) continue;
        const upd: StockItem = { ...cur, qty: Math.round((cur.qty + it.qty) * 1000) / 1000 };
        stock = stock.map((x) => (x.id === cur.id ? upd : x));
        touched.set(cur.id, upd);
      }
      commit({ ...d, stock, sales: d.sales.map((s) => (s.id === id ? saved : s)) });
      return persist(async () => {
        await repo.upsertSale(saved);
        await Promise.all(Array.from(touched.values()).map((s) => repo.upsertStockItem(s)));
      });
    };

    const openCash: Store['openCash'] = async (opening) => {
      const d = dbRef.current;
      if (findOpen(d)) return;
      const saved: CashSession = { id: uid(), openedAt: new Date().toISOString(), opening, moves: [], closedAt: null, counted: null };
      commit({ ...d, cash: [...d.cash, saved] });
      await persist(() => repo.upsertCashSession(saved));
    };

    const addCashMove: Store['addCashMove'] = async (type, amount, note) => {
      const d = dbRef.current;
      const open = findOpen(d);
      if (!open) return;
      const saved: CashSession = { ...open, moves: [...open.moves, { type, amount, note, at: new Date().toISOString() }] };
      commit({ ...d, cash: d.cash.map((c) => (c.id === saved.id ? saved : c)) });
      await persist(() => repo.upsertCashSession(saved));
    };

    const runBackup: Store['runBackup'] = async () => {
      downloadBackupFile(JSON.stringify(dbRef.current, null, 2));
      await setSettings({ lastBackupAt: new Date().toISOString() });
    };

    const closeCash: Store['closeCash'] = async (counted) => {
      const d = dbRef.current;
      const open = findOpen(d);
      if (!open) return null;
      const saved: CashSession = { ...open, closedAt: new Date().toISOString(), counted };
      commit({ ...d, cash: d.cash.map((c) => (c.id === saved.id ? saved : c)) });
      const ok = await persist(() => repo.upsertCashSession(saved));
      if (!ok) return null;
      if (dbRef.current.settings.autoBackup) {
        await runBackup();
        ui.toast('Caixa fechado. Uma cópia dos dados foi baixada automaticamente.');
      }
      return saved;
    };

    const addExpense: Store['addExpense'] = async (e) => {
      const saved: Expense = { id: uid(), ...e };
      commit({ ...dbRef.current, expenses: [...dbRef.current.expenses, saved] });
      await persist(() => repo.upsertExpense(saved));
    };

    const deleteExpense: Store['deleteExpense'] = async (id) => {
      commit({ ...dbRef.current, expenses: dbRef.current.expenses.filter((x) => x.id !== id) });
      await persist(() => repo.deleteExpense(id));
    };

    const importBackup: Store['importBackup'] = async (text) => {
      let next: DB;
      try {
        next = parseBackup(text);
      } catch {
        ui.toast('Arquivo de backup inválido.');
        return false;
      }
      commit(next);
      return persist(() => repo.importAll(next));
    };

    return {
      setSettings, addStock, setStockQty, deleteStock, addProduct, updateProduct, deleteProduct,
      addShopping, toggleShopping, deleteShopping, finalizeSale, voidSale,
      openCash, addCashMove, closeCash, addExpense, deleteExpense, runBackup, importBackup,
    };
  }, [ui]);

  const value = useMemo<Store>(
    () => ({ ...actions, db, loading, openSession: db.cash.find((c) => c.closedAt === null) ?? null }),
    [actions, db, loading],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
