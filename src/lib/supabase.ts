import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** False when env is missing — app still boots for local-only work / UI dev. */
export const supabaseConfigured = Boolean(isValidSupabaseUrl(url) && anonKey);

if (!supabaseConfigured) {
  console.warn(
    '[air] Supabase URL/key missing or invalid — running local-only instead of blocking startup.'
  );
}

const clientUrl = supabaseConfigured ? url : 'http://localhost:54321';
const clientKey = supabaseConfigured ? anonKey : 'anon-key';

export const supabase = createClient(clientUrl!, clientKey!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
