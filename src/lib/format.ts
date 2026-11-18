export const brl = (v: number): string => 'R$ ' + (Number(v) || 0).toFixed(2).replace('.', ',');

export const num = (v: number): string => (Math.round(v * 1000) / 1000).toString().replace('.', ',');

export const round2 = (v: number): number => Math.round(v * 100) / 100;

export const fdt = (d: string): string =>
  new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Gera um UUID (o Supabase usa uuid como chave). */
export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Data de hoje (horário local) no formato AAAA-MM-DD. */
export const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Converte AAAA-MM-DD em data local (sem erro de fuso horário). */
export const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const fdate = (s: string): string => parseLocalDate(s).toLocaleDateString('pt-BR');
