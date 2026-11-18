import { supabase } from '../lib/supabase';
import { LocalRepository } from './localRepository';
import { SupabaseRepository } from './supabaseRepository';
import type { Repository } from './repository';

/**
 * Escolha automática do banco:
 *  - com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY preenchidos => Supabase
 *  - sem elas => dados salvos no navegador deste computador
 */
export const repo: Repository = supabase ? new SupabaseRepository(supabase) : new LocalRepository();
export const storageMode: 'supabase' | 'local' = supabase ? 'supabase' : 'local';
