import type { DataBackend } from './backend';
import { createLocalBackend } from './localBackend';
import { createSupabaseBackend } from './supabaseBackend';

let backend: DataBackend | null = null;

/**
 * Backend em uso.
 *
 * Com as duas variáveis do Supabase definidas, usa o Supabase. Caso
 * contrário, usa IndexedDB (modo de demonstração). A decisão é feita uma vez
 * por sessão de browser.
 */
export function getBackend(): DataBackend {
  if (backend) return backend;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  backend = url && anonKey ? createSupabaseBackend(url, anonKey) : createLocalBackend();
  return backend;
}

export function backendMode(): 'local' | 'supabase' {
  return process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? 'supabase'
    : 'local';
}

export { BackendError } from './backend';
export type { DataBackend } from './backend';
