// llm-router — Deno entry point. All logic lives in ./handler.ts so vitest can
// exercise the rate-limit + dispatch paths without booting an edge runtime.
// Here we do only the two things that need Deno: build the real Supabase
// client and read secrets from env.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { handle, type DoubtSessionRow, type TriangulateRow } from './handler.ts';
import type { Provider } from './providers.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const apiKeys: Record<Provider, string> = {
  groq: Deno.env.get('GROQ_API_KEY') ?? '',
  gemini: Deno.env.get('GEMINI_API_KEY') ?? '',
  openrouter: Deno.env.get('OPENROUTER_API_KEY') ?? '',
  cerebras: Deno.env.get('CEREBRAS_API_KEY') ?? ''
};

Deno.serve((req: Request) =>
  handle(req, {
    async getUserFromJwt(jwt) {
      const user = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const { data, error } = await user.auth.getUser();
      if (error || !data?.user) return null;
      return { id: data.user.id };
    },
    async getUsageToday(userId) {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await admin
        .from('llm_usage_daily')
        .select('count')
        .eq('user_id', userId)
        .eq('day', today)
        .maybeSingle();
      return data?.count ?? 0;
    },
    async bumpUsage(userId) {
      await admin.rpc('increment_llm_usage', { uid: userId });
    },
    async logDoubtSession(row: DoubtSessionRow) {
      await admin.from('doubt_sessions').insert(row);
    },
    async logTriangulate(row: TriangulateRow) {
      await admin.from('triangulate_logs').insert(row);
    },
    apiKeys
  })
);
