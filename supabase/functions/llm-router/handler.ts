// Framework-free request handler for the llm-router edge function. The Deno
// entry point (`index.ts`) wires real Supabase + fetch deps into `handle`;
// tests wire mocks. That split is what lets vitest cover the 429 boundary and
// the doubt/triangulate logging paths without booting an actual edge runtime.
import {
  DAILY_LIMIT,
  DEFAULT_PROVIDER_CALLS,
  ROUTES,
  creditCost,
  nextResetIso,
  systemPrefixFor,
  wouldExceedLimit,
  type CallResult,
  type LLMUseCase,
  type Provider,
  type ProviderCall
} from './providers.ts';

export interface RouterRequest {
  use_case?: string;
  prompt?: string;
  question_id?: string | null;
  // Client-side template name for audit ("quick_explain", "variation", …).
  template?: string | null;
  /** Base64-encoded image (no data: prefix). Only used by vision-capable routes. */
  image_base64?: string;
  /** MIME type for `image_base64`. Defaults to image/jpeg. */
  image_mime_type?: string;
}

export interface RouterDeps {
  /** Resolves caller from Authorization header; null → 401. */
  getUserFromJwt: (jwt: string) => Promise<{ id: string } | null>;
  /** Returns today's `count` from `llm_usage_daily` for `userId`. */
  getUsageToday: (userId: string) => Promise<number>;
  /** Bumps counter once (idempotent per (user, day) via upsert in migrations). */
  bumpUsage: (userId: string) => Promise<void>;
  /** Log a single-provider response to `doubt_sessions`. */
  logDoubtSession: (row: DoubtSessionRow) => Promise<void>;
  /** Log a fan-out response to `triangulate_logs`. Returns the row id so the
   *  client can update `user_conclusion` when the user saves. */
  logTriangulate: (row: TriangulateRow) => Promise<string>;
  /** API keys, keyed by provider. */
  apiKeys: Record<Provider, string>;
  /** Per-provider call function. Injectable so tests can stub network. */
  providerCalls?: Record<Provider, ProviderCall>;
  /** Injectable clock — used for the reset header. */
  now?: () => Date;
}

export interface DoubtSessionRow {
  user_id: string;
  question_id: string | null;
  use_case: LLMUseCase;
  template_used: string | null;
  user_input: string;
  provider: Provider;
  model: string;
  response: string;
  latency_ms: number;
}

export interface TriangulateRow {
  user_id: string;
  prompt: string;
  groq_resp: string | null;
  gemini_resp: string | null;
  openrouter_resp: string | null;
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra }
  });
}

function isKnownUseCase(v: string | undefined): v is LLMUseCase {
  return typeof v === 'string' && v in ROUTES;
}

function pickJwt(req: Request): string {
  const auth = req.headers.get('Authorization') ?? '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

export async function handle(req: Request, deps: RouterDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const jwt = pickJwt(req);
  if (!jwt) return json({ error: 'unauthenticated' }, 401);
  const user = await deps.getUserFromJwt(jwt);
  if (!user) return json({ error: 'unauthenticated' }, 401);

  let body: RouterRequest;
  try {
    body = (await req.json()) as RouterRequest;
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  if (!body.prompt || typeof body.prompt !== 'string') {
    return json({ error: 'prompt is required' }, 400);
  }
  if (!isKnownUseCase(body.use_case)) {
    return json({ error: 'unknown or missing use_case' }, 400);
  }
  const useCase = body.use_case;

  // Rate limit check happens BEFORE any provider call so a client near the cap
  // never fires a doomed triangulate fan-out.
  const used = await deps.getUsageToday(user.id);
  if (wouldExceedLimit(used, useCase)) {
    const reset = nextResetIso(deps.now?.() ?? new Date());
    return json(
      {
        error: 'daily quota reached',
        limit: DAILY_LIMIT,
        used,
        cost: creditCost(useCase),
        retry_after: reset
      },
      429,
      { 'X-RateLimit-Reset': reset, 'Retry-After': reset }
    );
  }

  const calls = deps.providerCalls ?? DEFAULT_PROVIDER_CALLS;
  const route = ROUTES[useCase];

  if (Array.isArray(route)) {
    // Triangulate: parallel calls, don't fail whole request if one provider errors.
    const settled = await Promise.allSettled(
      route.map((r) =>
        calls[r.provider]({
          prompt: body.prompt as string,
          apiKey: deps.apiKeys[r.provider],
          model: r.model
        })
      )
    );
    // Charge all 3 credits regardless — the request consumed intent for all.
    for (let i = 0; i < creditCost(useCase); i++) await deps.bumpUsage(user.id);

    const readResp = (s: PromiseSettledResult<CallResult>): string | null =>
      s.status === 'fulfilled' ? s.value.text : `error: ${errMsg(s.reason)}`;
    const readLat = (s: PromiseSettledResult<CallResult>): number | null =>
      s.status === 'fulfilled' ? s.value.latencyMs : null;

    const [g, m, o] = settled;
    const triangulateId = await deps.logTriangulate({
      user_id: user.id,
      prompt: body.prompt,
      groq_resp: readResp(g),
      gemini_resp: readResp(m),
      openrouter_resp: readResp(o)
    });

    return json({
      use_case: useCase,
      triangulate_id: triangulateId,
      responses: [
        { provider: 'groq', model: route[0].model, response: readResp(g), latency_ms: readLat(g) },
        { provider: 'gemini', model: route[1].model, response: readResp(m), latency_ms: readLat(m) },
        { provider: 'openrouter', model: route[2].model, response: readResp(o), latency_ms: readLat(o) }
      ]
    });
  }

  // Single-provider path.
  try {
    const result = await calls[route.provider]({
      prompt: body.prompt,
      apiKey: deps.apiKeys[route.provider],
      model: route.model,
      systemPrefix: systemPrefixFor(useCase),
      imageBase64: body.image_base64,
      imageMimeType: body.image_mime_type
    });
    await deps.bumpUsage(user.id);
    await deps.logDoubtSession({
      user_id: user.id,
      question_id: body.question_id ?? null,
      use_case: useCase,
      template_used: body.template ?? null,
      user_input: body.prompt,
      provider: route.provider,
      model: route.model,
      response: result.text,
      latency_ms: result.latencyMs
    });
    return json({
      use_case: useCase,
      provider: route.provider,
      model: route.model,
      response: result.text,
      latency_ms: result.latencyMs
    });
  } catch (err) {
    // Provider failure: don't bump usage, don't log a doubt row.
    return json({ error: errMsg(err) }, 502);
  }
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'unknown error';
  }
}
