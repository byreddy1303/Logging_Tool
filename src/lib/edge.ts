// Thin, typed wrappers for the non-LLM edge functions:
//   - request-access   (public: uses anon key as bearer since Supabase's
//                       function gateway always requires an auth header)
//   - approve-request  (owner auth)
//   - decline-request  (owner auth)
//   - weekly-insight   (any auth)
// Keeps error handling consistent so pages don't reinvent status-code parsing.
import { supabase } from '@/lib/supabase';

function functionsBase(): string {
  const url =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'http://localhost:54321';
  return `${url.replace(/\/$/, '')}/functions/v1`;
}

function anonKey(): string {
  return (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
}

async function currentJwt(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export interface RequestAccessInput {
  name: string;
  email: string;
  purpose: string;
  /** Honeypot — leave empty. */
  website?: string;
}

export interface RequestAccessOk {
  ok: true;
  id?: string;
  dedup?: boolean;
}

export interface EdgeError {
  ok: false;
  status: number;
  error: string;
}

export async function requestAccess(
  input: RequestAccessInput
): Promise<RequestAccessOk | EdgeError> {
  const key = anonKey();
  if (!key) {
    return { ok: false, status: 0, error: 'Supabase is not configured yet.' };
  }
  const res = await fetch(`${functionsBase()}/request-access`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Supabase Functions Gateway requires an auth header on every request.
      // For public endpoints we use the anon key — the edge fn's own logic
      // then decides what to do with the payload.
      Authorization: `Bearer ${key}`,
      apikey: key
    },
    body: JSON.stringify(input)
  }).catch((e) => {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 0 });
  });
  const body = (await readJson(res)) as { ok?: boolean; id?: string; dedup?: boolean; error?: string } | null;
  if (res.ok && body?.ok) return { ok: true, id: body.id, dedup: body.dedup };
  return {
    ok: false,
    status: res.status,
    error: body?.error ?? `request-access ${res.status}`
  };
}

export interface ApproveResult {
  ok: true;
  invite_id: string;
  invite_url: string;
  mail_sent: boolean;
  mail_error?: string;
}

export async function approveRequest(requestId: string): Promise<ApproveResult | EdgeError> {
  const jwt = await currentJwt();
  if (!jwt) return { ok: false, status: 401, error: 'Sign in first.' };
  const res = await fetch(`${functionsBase()}/approve-request`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ request_id: requestId })
  });
  const body = (await readJson(res)) as
    | (ApproveResult & { ok: true })
    | { error?: string }
    | null;
  if (res.ok && body && (body as ApproveResult).ok) return body as ApproveResult;
  return {
    ok: false,
    status: res.status,
    error: (body as { error?: string })?.error ?? `approve ${res.status}`
  };
}

export interface DeclineResult {
  ok: true;
  mail_sent: boolean;
  mail_error?: string;
}

export async function declineRequest(
  requestId: string,
  opts: { reason?: string; notify?: boolean } = {}
): Promise<DeclineResult | EdgeError> {
  const jwt = await currentJwt();
  if (!jwt) return { ok: false, status: 401, error: 'Sign in first.' };
  const res = await fetch(`${functionsBase()}/decline-request`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ request_id: requestId, reason: opts.reason, notify: opts.notify })
  });
  const body = (await readJson(res)) as
    | (DeclineResult & { ok: true })
    | { error?: string }
    | null;
  if (res.ok && body && (body as DeclineResult).ok) return body as DeclineResult;
  return {
    ok: false,
    status: res.status,
    error: (body as { error?: string })?.error ?? `decline ${res.status}`
  };
}

export interface WeeklyInsightResult {
  sentence: string;
  cached: boolean;
  generated_at?: string;
  empty?: boolean;
  latency_ms?: number;
}

export async function fetchWeeklyInsight(
  opts: { force?: boolean } = {}
): Promise<WeeklyInsightResult | EdgeError> {
  const jwt = await currentJwt();
  if (!jwt) return { ok: false, status: 401, error: 'no session' };
  const res = await fetch(`${functionsBase()}/weekly-insight`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ force: opts.force === true })
  });
  const body = (await readJson(res)) as WeeklyInsightResult | { error?: string } | null;
  if (res.ok && body && typeof (body as WeeklyInsightResult).sentence === 'string') {
    return body as WeeklyInsightResult;
  }
  return {
    ok: false,
    status: res.status,
    error: (body as { error?: string })?.error ?? `weekly-insight ${res.status}`
  };
}

export function isEdgeError(x: unknown): x is EdgeError {
  return typeof x === 'object' && x !== null && (x as { ok?: boolean }).ok === false;
}
