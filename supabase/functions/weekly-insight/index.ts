// POST /functions/v1/weekly-insight
// Auth: caller JWT (any user). Returns a cached-or-freshly-generated
// one-sentence "read" of the caller's last 7 days of tagging.
// Cached in insights_daily per (user, calendar-day). Regenerates when the
// underlying data hash changes.
//
// Never sets outcome / root_cause / pattern (BUILD §2.5). Just names one
// observation the user should notice. Costs 1 llm_usage credit per fresh
// generation; cache hits are free.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GROQ_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const DAILY_LIMIT = 100;

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

interface QuestionRow {
  subject: string;
  outcome: 'R' | 'RBS' | 'RBG' | 'W-C' | 'W-E' | 'W-R';
  pattern_name: string | null;
  root_cause: string | null;
  time_spent_sec: number;
  created_at: string;
}

interface Aggregate {
  total: number;
  bySubject: Record<string, number>;
  byOutcome: Record<string, number>;
  wrongBySubject: Record<string, number>;
  topPatterns: Array<{ name: string; count: number }>;
  rootCauseDominant: string | null;
  daysActive: number;
  totalMinutes: number;
}

function aggregate(rows: QuestionRow[]): Aggregate {
  const bySubject: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  const wrongBySubject: Record<string, number> = {};
  const patternCounts: Record<string, number> = {};
  const rootCauseCounts: Record<string, number> = {};
  const activeDays = new Set<string>();
  let totalSec = 0;
  for (const r of rows) {
    bySubject[r.subject] = (bySubject[r.subject] ?? 0) + 1;
    byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;
    if (r.outcome !== 'R') {
      wrongBySubject[r.subject] = (wrongBySubject[r.subject] ?? 0) + 1;
    }
    if (r.pattern_name) patternCounts[r.pattern_name] = (patternCounts[r.pattern_name] ?? 0) + 1;
    if (r.root_cause) rootCauseCounts[r.root_cause] = (rootCauseCounts[r.root_cause] ?? 0) + 1;
    activeDays.add(r.created_at.slice(0, 10));
    totalSec += r.time_spent_sec;
  }
  const topPatterns = Object.entries(patternCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
  const rootCauseDominant =
    Object.entries(rootCauseCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
  return {
    total: rows.length,
    bySubject,
    byOutcome,
    wrongBySubject,
    topPatterns,
    rootCauseDominant,
    daysActive: activeDays.size,
    totalMinutes: Math.round(totalSec / 60)
  };
}

async function sha256hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s);
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildPrompt(agg: Aggregate): string {
  return `You are looking at ONE week of a GATE CS aspirant's PYQ practice. Do not praise, do not shame, do not moralize. Do not include headings, bullets, or emojis. Return ONE sentence, at most 30 words, that names the single most useful observation in the data — a lean, an under-invested area, a pattern of loss, or a shift in cadence. Prefer specific subject / count / percentage over vague language. If data is thin, say so plainly in one sentence.

Data (last 7 days):
- total questions tagged: ${agg.total}
- active days: ${agg.daysActive}/7
- total practice minutes: ${agg.totalMinutes}
- by subject: ${JSON.stringify(agg.bySubject)}
- by outcome: ${JSON.stringify(agg.byOutcome)}
- wrong (non-R) by subject: ${JSON.stringify(agg.wrongBySubject)}
- dominant root cause: ${agg.rootCauseDominant ?? '—'}
- top patterns: ${JSON.stringify(agg.topPatterns)}`;
}

async function callGroq(prompt: string): Promise<{ text: string; latencyMs: number }> {
  const started = Date.now();
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 120
    })
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`groq ${res.status}: ${t.slice(0, 160)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = (data.choices?.[0]?.message?.content ?? '').trim();
  return { text, latencyMs: Date.now() - started };
}

function cleanSentence(s: string): string {
  return s
    .replace(/^"|"$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!jwt) return json({ error: 'no auth' }, 401);
  const asUser = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData } = await asUser.auth.getUser();
  if (!userData?.user) return json({ error: 'invalid session' }, 401);
  const uid = userData.user.id;

  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  const force = body.force === true;

  const today = new Date().toISOString().slice(0, 10);

  // Cache read.
  if (!force) {
    const { data: cached } = await admin
      .from('insights_daily')
      .select('sentence, data_hash, generated_at')
      .eq('user_id', uid)
      .eq('day', today)
      .maybeSingle();
    if (cached) {
      return json({
        sentence: cached.sentence,
        generated_at: cached.generated_at,
        cached: true
      });
    }
  }

  // Pull last 7 days of tagged questions for this user.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error: qErr } = await admin
    .from('questions')
    .select('subject, outcome, pattern_name, root_cause, time_spent_sec, created_at')
    .eq('user_id', uid)
    .gte('created_at', sevenDaysAgo)
    .limit(2000);
  if (qErr) return json({ error: qErr.message }, 500);

  const agg = aggregate((rows ?? []) as QuestionRow[]);
  const hash = await sha256hex(JSON.stringify(agg));

  // If cache exists with same hash even on force, prefer no LLM call.
  if (force) {
    const { data: cached } = await admin
      .from('insights_daily')
      .select('sentence, data_hash, generated_at')
      .eq('user_id', uid)
      .eq('day', today)
      .maybeSingle();
    if (cached && cached.data_hash === hash) {
      return json({ sentence: cached.sentence, generated_at: cached.generated_at, cached: true });
    }
  }

  // Empty-state sentence: skip Groq entirely.
  if (agg.total === 0) {
    const sentence =
      'No questions tagged in the last seven days — the read starts once you log a session.';
    await admin
      .from('insights_daily')
      .upsert(
        { user_id: uid, day: today, sentence, data_hash: hash, provider: 'groq' },
        { onConflict: 'user_id,day' }
      );
    return json({ sentence, cached: false, empty: true });
  }

  // Rate-limit check.
  const { data: usage } = await admin
    .from('llm_usage_daily')
    .select('count')
    .eq('user_id', uid)
    .eq('day', today)
    .maybeSingle();
  const used = usage?.count ?? 0;
  if (used >= DAILY_LIMIT) {
    return json({ error: 'rate_limited', retry_after: 'tomorrow' }, 429);
  }

  if (!GROQ_KEY) return json({ error: 'GROQ_API_KEY not configured' }, 500);

  let generated: { text: string; latencyMs: number };
  try {
    generated = await callGroq(buildPrompt(agg));
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
  const sentence = cleanSentence(generated.text);
  if (!sentence) return json({ error: 'empty generation' }, 502);

  // Bump usage; ignore RPC error, that's not fatal for the response.
  await admin.rpc('increment_llm_usage', { uid });

  await admin
    .from('insights_daily')
    .upsert(
      { user_id: uid, day: today, sentence, data_hash: hash, provider: 'groq' },
      { onConflict: 'user_id,day' }
    );

  return json({ sentence, cached: false, latency_ms: generated.latencyMs });
});
