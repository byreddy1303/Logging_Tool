import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False when env is missing — app still boots for local-only work / UI dev. */
export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.warn('[air] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — running local-only.');
}

export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
