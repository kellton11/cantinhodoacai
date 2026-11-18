import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Verdadeiro quando as duas variáveis do .env.local estão preenchidas. */
export const isSupabaseConfigured: boolean = Boolean(url && key);

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
