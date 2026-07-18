// Client-side wrapper around the llm-router edge function. Handles auth
// (pulls JWT from the current Supabase session), maps 429 to a typed error
// so callers can render a "quota reached" state, and returns the shaped
// response the server sends back.
import { supabase, supabaseConfigured } from '@/lib/supabase';

export type LLMUseCase =
  | 'quick_explain'
  | 'deep_doubt'
  | 'triangulate'
  | 'long_context'
  | 'reflex_score'
  | 'variation'
  | 'formula_extract';

export interface LLMRequest {
  use_case: LLMUseCase;
  prompt: string;
  question_id?: string | null;
  template?: string | null;
}

export interface LLMSingleResponse {
  use_case: Exclude<LLMUseCase, 'triangulate'>;
  provider: 'groq' | 'gemini' | 'openrouter' | 'cerebras';
  model: string;
  response: string;
  latency_ms: number;
}

export interface LLMTriangulateResponse {
  use_case: 'triangulate';
  triangulate_id: string;
  responses: {
    provider: 'groq' | 'gemini' | 'openrouter';
    model: string;
    response: string;
    latency_ms: number | null;
  }[];
}

export type LLMResponse = LLMSingleResponse | LLMTriangulateResponse;

export class LLMError extends Error {
  readonly status: number;
  readonly code: 'quota' | 'unauth' | 'not_configured' | 'provider' | 'bad_request' | 'unknown';
  readonly retryAfter: string | null;
  readonly used: number | null;
  readonly limit: number | null;

  constructor(init: {
    message: string;
    status: number;
    code: LLMError['code'];
    retryAfter?: string | null;
    used?: number | null;
    limit?: number | null;
  }) {
    super(init.message);
    this.status = init.status;
    this.code = init.code;
    this.retryAfter = init.retryAfter ?? null;
    this.used = init.used ?? null;
    this.limit = init.limit ?? null;
  }
}

function functionsUrl(): string {
  const base =
    (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'http://localhost:54321';
  // Supabase Functions Gateway rewrites /functions/v1/<name>.
  return `${base.replace(/\/$/, '')}/functions/v1/llm-router`;
}

async function currentJwt(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

interface CallLLMOptions {
  /** For tests. Falls back to global fetch. */
  fetchFn?: typeof fetch;
  /** Explicit JWT override; skips supabase.auth.getSession(). */
  jwt?: string;
  /** Signal for aborting long calls (e.g. Triangulate). */
  signal?: AbortSignal;
}

export async function callLLM(
  req: LLMRequest,
  opts: CallLLMOptions = {}
): Promise<LLMResponse> {
  if (!supabaseConfigured && !opts.jwt) {
    throw new LLMError({
      message: 'LLM router not available in local-only mode',
      status: 0,
      code: 'not_configured'
    });
  }
  const jwt = opts.jwt ?? (await currentJwt());
  if (!jwt) {
    throw new LLMError({ message: 'Sign in to use AI features', status: 401, code: 'unauth' });
  }

  const doFetch = opts.fetchFn ?? fetch;
  const url = functionsUrl();
  let resp: Response;
  try {
    resp = await doFetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req),
      signal: opts.signal
    });
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') throw err;
    if (err instanceof LLMError) throw err;
    throw new LLMError({
      message: (err as Error).message ?? 'network error',
      status: 0,
      code: 'unknown'
    });
  }

  if (resp.status === 429) {
    const body = await safeJson(resp);
    const bodyRetry = typeof body?.retry_after === 'string' ? body.retry_after : null;
    throw new LLMError({
      message: 'Daily AI quota reached',
      status: 429,
      code: 'quota',
      retryAfter: resp.headers.get('X-RateLimit-Reset') ?? bodyRetry,
      used: typeof body?.used === 'number' ? body.used : null,
      limit: typeof body?.limit === 'number' ? body.limit : null
    });
  }
  if (resp.status === 401) {
    throw new LLMError({ message: 'Not authenticated', status: 401, code: 'unauth' });
  }
  if (resp.status === 400) {
    const body = await safeJson(resp);
    throw new LLMError({
      message: typeof body?.error === 'string' ? body.error : 'Bad request',
      status: 400,
      code: 'bad_request'
    });
  }
  if (resp.status === 502) {
    const body = await safeJson(resp);
    throw new LLMError({
      message: typeof body?.error === 'string' ? body.error : 'Provider unavailable',
      status: 502,
      code: 'provider'
    });
  }
  if (!resp.ok) {
    throw new LLMError({
      message: `LLM router ${resp.status}`,
      status: resp.status,
      code: 'unknown'
    });
  }
  return (await resp.json()) as LLMResponse;
}

async function safeJson(resp: Response): Promise<{ [k: string]: unknown } | null> {
  try {
    return (await resp.json()) as { [k: string]: unknown };
  } catch {
    return null;
  }
}
