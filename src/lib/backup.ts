import type { DB, TabId } from '../types';
import { defaultSettings, normalizeDB } from '../data/defaults';
import { uid } from './format';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Lê um arquivo de backup.
 * Aceita o formato deste sistema (qualquer versão) e o formato do arquivo HTML antigo
 * "cantinho-do-acai.html". No antigo, os códigos viram UUIDs e a senha é zerada.
 */
export function parseBackup(text: string): DB {
  const raw = JSON.parse(text) as any;
  if (!raw || typeof raw !== 'object' || !raw.settings || !Array.isArray(raw.stock)) {
    throw new Error('Arquivo de backup inválido.');
  }

  // Formato do sistema React (tem "pricePerKg" nas configurações)
  if (Array.isArray(raw.cash) && 'pricePerKg' in raw.settings) {
    return normalizeDB(raw as Partial<DB>);
  }

  // Formato antigo (arquivo HTML)
  const ids = new Map<string, string>();
  const map = (id: unknown): string => {
    const k = String(id);
    let v = ids.get(k);
    if (!v) {
      v = uid();
      ids.set(k, v);
    }
    return v;
  };
  const old = raw.settings;
  const lockedTabs: TabId[] = Array.isArray(old.locked) ? (old.locked as TabId[]) : defaultSettings.lockedTabs;

  const cash: any[] = [];
  const hist: any[] = Array.isArray(raw.cash?.history) ? raw.cash.history : [];
  hist.forEach((r) =>
    cash.push({
      id: map(r.id),
      openedAt: String(r.openedAt),
      opening: Number(r.opening) || 0,
      moves: Array.isArray(r.moves) ? r.moves : [],
      closedAt: String(r.closedAt),
      counted: Number(r.counted) || 0,
    }),
  );
  if (raw.cash?.open) {
    const o = raw.cash.open;
    cash.push({
      id: map(o.id),
      openedAt: String(o.at),
      opening: Number(o.opening) || 0,
      moves: Array.isArray(o.moves) ? o.moves : [],
      closedAt: null,
      counted: null,
    });
  }

  const converted = {
    // "autoBackup" fica de fora de propósito: normalizeDB trata como dados antigos
    settings: {
      pricePerKg: Number(old.preco) || 0,
      baud: Number(old.baud) || 9600,
      unit: old.unit === 'g' ? 'g' : 'kg',
      acaiStockId: old.acaiStock ? map(old.acaiStock) : null,
      passHash: '',
      lockedTabs,
    },
    stock: (raw.stock as any[]).map((s) => ({
      id: map(s.id),
      name: String(s.name),
      qty: Number(s.qty) || 0,
      unit: String(s.unit ?? 'un'),
      min: Number(s.min) || 0,
    })),
    products: ((raw.products ?? []) as any[]).map((p) => ({
      id: map(p.id),
      name: String(p.name),
      price: Number(p.price) || 0,
      stockId: p.stockId ? map(p.stockId) : null,
    })),
    shopping: ((raw.shopping ?? []) as any[]).map((s) => ({
      id: map(s.id),
      name: String(s.name),
      need: String(s.need ?? ''),
      done: Boolean(s.done),
    })),
    sales: ((raw.sales ?? []) as any[]).map((s) => ({
      id: map(s.id),
      cashId: s.cashId ? map(s.cashId) : null,
      date: String(s.date),
      items: Array.isArray(s.items) ? s.items : [],
      total: Number(s.total) || 0,
      pay: s.pay,
      received: Number(s.received) || 0,
    })),
    cash,
  };
  return normalizeDB(converted as unknown as Partial<DB>);
}

const two = (n: number): string => String(n).padStart(2, '0');

/** Baixa o backup como arquivo .json (nome com data e hora). */
export function downloadBackupFile(json: string): void {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `backup-cantinho-do-acai-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
