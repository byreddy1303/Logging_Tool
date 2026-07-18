import { describe, expect, it, vi } from 'vitest';
import {
  DAILY_LIMIT,
  ROUTES,
  callCerebras,
  callGemini,
  callGroq,
  callOpenRouter,
  creditCost,
  systemPrefixFor,
  wouldExceedLimit,
  type CallResult,
  type Provider,
  type ProviderCall,
  type ProviderCallArgs
} from '../../supabase/functions/llm-router/providers';
import {
  handle,
  type DoubtSessionRow,
  type RouterDeps,
  type TriangulateRow
} from '../../supabase/functions/llm-router/handler';

// Convenience: build a `fetch` mock that returns a JSON body with a `.text()`
// fallback so provider adapters can dump the response body on non-2xx.
function fetchMock(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  });
}

// Small factory for the deps object. Callers spread over the pieces they care
// about; sensible defaults keep tests short.
function makeDeps(overrides: Partial<RouterDeps> = {}): {
  deps: RouterDeps;
  usage: { count: number };
  doubtLog: DoubtSessionRow[];
  triangulateLog: TriangulateRow[];
  bumpCount: () => number;
  provider: ReturnType<typeof vi.fn>;
} {
  const usage = { count: overrides.getUsageToday ? 0 : 0 };
  const doubtLog: DoubtSessionRow[] = [];
  const triangulateLog: TriangulateRow[] = [];
  let bumps = 0;
  const provider = vi
    .fn<(a: ProviderCallArgs) => Promise<CallResult>>()
    .mockResolvedValue({ text: 'ok', latencyMs: 42 });
  const providerCalls: Record<Provider, ProviderCall> = {
    groq: provider,
    gemini: provider,
    openrouter: provider,
    cerebras: provider
  };
  const deps: RouterDeps = {
    getUserFromJwt: async (jwt) => (jwt === 'good' ? { id: 'u1' } : null),
    getUsageToday: async () => usage.count,
    bumpUsage: async () => {
      bumps++;
    },
    logDoubtSession: async (r) => {
      doubtLog.push(r);
    },
    logTriangulate: async (r) => {
      triangulateLog.push(r);
      return `tri-${triangulateLog.length}`;
    },
    apiKeys: { groq: 'g', gemini: 'gm', openrouter: 'or', cerebras: 'c' },
    providerCalls,
    now: () => new Date('2026-07-18T10:00:00Z'),
    ...overrides
  };
  return { deps, usage, doubtLog, triangulateLog, provider, bumpCount: () => bumps };
}

function post(body: unknown, jwt = 'good'): Request {
  return new Request('https://x/functions/v1/llm', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

describe('providers: routing + credits', () => {
  it('routes each single-provider use-case', () => {
    expect(ROUTES.quick_explain).toEqual({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    expect(ROUTES.deep_doubt).toEqual({ provider: 'gemini', model: 'gemini-2.5-pro' });
    expect(ROUTES.long_context).toEqual({ provider: 'gemini', model: 'gemini-2.5-flash' });
    expect(ROUTES.reflex_score).toEqual({ provider: 'cerebras', model: 'llama-3.3-70b' });
    expect(ROUTES.variation).toEqual({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    expect(ROUTES.formula_extract).toEqual({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
  });

  it('triangulate fans out to three providers', () => {
    expect(Array.isArray(ROUTES.triangulate)).toBe(true);
    const t = ROUTES.triangulate as { provider: Provider }[];
    expect(t.map((r) => r.provider)).toEqual(['groq', 'gemini', 'openrouter']);
  });

  it('credit cost is 3 for triangulate, 1 otherwise', () => {
    expect(creditCost('triangulate')).toBe(3);
    expect(creditCost('quick_explain')).toBe(1);
    expect(creditCost('reflex_score')).toBe(1);
  });

  it('daily limit is 100', () => {
    expect(DAILY_LIMIT).toBe(100);
  });

  it('wouldExceedLimit accounts for cost', () => {
    expect(wouldExceedLimit(99, 'quick_explain')).toBe(false);
    expect(wouldExceedLimit(100, 'quick_explain')).toBe(true);
    expect(wouldExceedLimit(97, 'triangulate')).toBe(false);
    expect(wouldExceedLimit(98, 'triangulate')).toBe(true);
  });

  it('system prefix is set only for deep_doubt', () => {
    expect(systemPrefixFor('deep_doubt')).toMatch(/step-by-step/);
    expect(systemPrefixFor('quick_explain')).toBeUndefined();
    expect(systemPrefixFor('triangulate')).toBeUndefined();
  });
});

describe('providers: adapters send correct requests', () => {
  it('groq hits the OpenAI-compatible endpoint with bearer + model', async () => {
    const fetchFn = fetchMock({
      choices: [{ message: { content: 'hi' } }]
    });
    const r = await callGroq({
      prompt: 'q',
      apiKey: 'kkk',
      model: 'llama-3.3-70b-versatile',
      fetchFn: fetchFn as unknown as typeof fetch
    });
    expect(r.text).toBe('hi');
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain('api.groq.com');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer kkk' });
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.model).toBe('llama-3.3-70b-versatile');
    expect(body.messages[0]).toEqual({ role: 'user', content: 'q' });
  });

  it('groq prepends a system message when systemPrefix is provided', async () => {
    const fetchFn = fetchMock({ choices: [{ message: { content: '' } }] });
    await callGroq({
      prompt: 'q',
      apiKey: 'k',
      model: 'm',
      systemPrefix: 'Think step-by-step.',
      fetchFn: fetchFn as unknown as typeof fetch
    });
    const body = JSON.parse(String((fetchFn.mock.calls[0][1] as RequestInit).body));
    expect(body.messages[0]).toEqual({ role: 'system', content: 'Think step-by-step.' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'q' });
  });

  it('gemini hits generateContent with the api key as a query param', async () => {
    const fetchFn = fetchMock({
      candidates: [{ content: { parts: [{ text: 'ge' }, { text: 'mini' }] } }]
    });
    const r = await callGemini({
      prompt: 'q',
      apiKey: 'AKEY',
      model: 'gemini-2.5-pro',
      fetchFn: fetchFn as unknown as typeof fetch
    });
    expect(r.text).toBe('gemini');
    const [url] = fetchFn.mock.calls[0];
    expect(String(url)).toMatch(/models\/gemini-2\.5-pro:generateContent\?key=AKEY/);
  });

  it('openrouter sends model + referer header', async () => {
    const fetchFn = fetchMock({ choices: [{ message: { content: 'or' } }] });
    const r = await callOpenRouter({
      prompt: 'q',
      apiKey: 'k',
      model: 'deepseek/deepseek-r1',
      fetchFn: fetchFn as unknown as typeof fetch
    });
    expect(r.text).toBe('or');
    expect((fetchFn.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      'HTTP-Referer': 'https://air-journal.app'
    });
  });

  it('cerebras caps max_tokens tiny (reflex use case)', async () => {
    const fetchFn = fetchMock({ choices: [{ message: { content: 'MATCH' } }] });
    const r = await callCerebras({
      prompt: 'q',
      apiKey: 'k',
      model: 'llama-3.3-70b',
      fetchFn: fetchFn as unknown as typeof fetch
    });
    expect(r.text).toBe('MATCH');
    const body = JSON.parse(String((fetchFn.mock.calls[0][1] as RequestInit).body));
    expect(body.max_tokens).toBe(32);
  });

  it('provider throws on non-2xx with body text', async () => {
    const fetchFn = fetchMock({ error: 'nope' }, false, 500);
    await expect(
      callGroq({
        prompt: 'q',
        apiKey: 'k',
        model: 'm',
        fetchFn: fetchFn as unknown as typeof fetch
      })
    ).rejects.toThrow(/groq 500/);
  });
});

describe('handler: auth + validation', () => {
  it('OPTIONS preflight returns 200 with CORS headers', async () => {
    const { deps } = makeDeps();
    const req = new Request('https://x', { method: 'OPTIONS' });
    const resp = await handle(req, deps);
    expect(resp.status).toBe(200);
    expect(resp.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('non-POST returns 405', async () => {
    const { deps } = makeDeps();
    const req = new Request('https://x', { method: 'GET' });
    const resp = await handle(req, deps);
    expect(resp.status).toBe(405);
  });

  it('missing Authorization → 401', async () => {
    const { deps } = makeDeps();
    const req = new Request('https://x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ use_case: 'quick_explain', prompt: 'p' })
    });
    const resp = await handle(req, deps);
    expect(resp.status).toBe(401);
  });

  it('invalid JWT → 401', async () => {
    const { deps } = makeDeps();
    const resp = await handle(post({ use_case: 'quick_explain', prompt: 'p' }, 'bad'), deps);
    expect(resp.status).toBe(401);
  });

  it('missing use_case → 400', async () => {
    const { deps } = makeDeps();
    const resp = await handle(post({ prompt: 'p' }), deps);
    expect(resp.status).toBe(400);
  });

  it('unknown use_case → 400', async () => {
    const { deps } = makeDeps();
    const resp = await handle(post({ use_case: 'nope', prompt: 'p' }), deps);
    expect(resp.status).toBe(400);
  });

  it('missing prompt → 400', async () => {
    const { deps } = makeDeps();
    const resp = await handle(post({ use_case: 'quick_explain' }), deps);
    expect(resp.status).toBe(400);
  });
});

describe('handler: rate limit', () => {
  it('allows the 100th single call', async () => {
    const { deps, usage } = makeDeps();
    usage.count = 99;
    const resp = await handle(post({ use_case: 'quick_explain', prompt: 'p' }), deps);
    expect(resp.status).toBe(200);
  });

  it('rejects the 101st single call with 429 + X-RateLimit-Reset', async () => {
    const { deps, usage } = makeDeps();
    usage.count = 100;
    const resp = await handle(post({ use_case: 'quick_explain', prompt: 'p' }), deps);
    expect(resp.status).toBe(429);
    const reset = resp.headers.get('X-RateLimit-Reset');
    expect(reset).toBe('2026-07-19T00:00:00.000Z');
    const body = await resp.json();
    expect(body.limit).toBe(100);
    expect(body.used).toBe(100);
    expect(body.retry_after).toBe(reset);
  });

  it('rejects triangulate when only 2 credits remain', async () => {
    const { deps, usage } = makeDeps();
    usage.count = 98;
    const resp = await handle(post({ use_case: 'triangulate', prompt: 'p' }), deps);
    expect(resp.status).toBe(429);
    const body = await resp.json();
    expect(body.cost).toBe(3);
  });

  it('allows triangulate when 3 credits remain', async () => {
    const { deps, usage } = makeDeps();
    usage.count = 97;
    const resp = await handle(post({ use_case: 'triangulate', prompt: 'p' }), deps);
    expect(resp.status).toBe(200);
  });
});

describe('handler: dispatch + logging', () => {
  it('single-provider path bumps once and logs a doubt session', async () => {
    const { deps, doubtLog, bumpCount } = makeDeps();
    const resp = await handle(
      post({ use_case: 'quick_explain', prompt: 'p', question_id: 'Q', template: 'quick_explain' }),
      deps
    );
    expect(resp.status).toBe(200);
    expect(bumpCount()).toBe(1);
    expect(doubtLog).toHaveLength(1);
    expect(doubtLog[0]).toMatchObject({
      user_id: 'u1',
      question_id: 'Q',
      use_case: 'quick_explain',
      provider: 'groq',
      model: 'llama-3.3-70b-versatile',
      response: 'ok',
      latency_ms: 42
    });
  });

  it('deep_doubt passes the "step-by-step" system prefix down to the provider', async () => {
    const { deps, provider } = makeDeps();
    await handle(post({ use_case: 'deep_doubt', prompt: 'p' }), deps);
    const call = provider.mock.calls[0][0] as ProviderCallArgs;
    expect(call.systemPrefix).toMatch(/step-by-step/);
  });

  it('triangulate fans out and logs all three responses; charges 3 credits', async () => {
    const { deps, triangulateLog, bumpCount, provider } = makeDeps();
    provider
      .mockResolvedValueOnce({ text: 'g', latencyMs: 1 })
      .mockResolvedValueOnce({ text: 'm', latencyMs: 2 })
      .mockResolvedValueOnce({ text: 'o', latencyMs: 3 });
    const resp = await handle(post({ use_case: 'triangulate', prompt: 'p' }), deps);
    expect(resp.status).toBe(200);
    expect(bumpCount()).toBe(3);
    expect(triangulateLog).toHaveLength(1);
    expect(triangulateLog[0]).toMatchObject({
      user_id: 'u1',
      prompt: 'p',
      groq_resp: 'g',
      gemini_resp: 'm',
      openrouter_resp: 'o'
    });
    const body = (await resp.json()) as {
      triangulate_id: string;
      responses: { provider: string; response: string }[];
    };
    expect(body.responses.map((r) => r.provider)).toEqual(['groq', 'gemini', 'openrouter']);
    expect(body.triangulate_id).toBe('tri-1');
  });

  it('triangulate survives one provider failing — still charges 3 credits', async () => {
    const { deps, triangulateLog, bumpCount, provider } = makeDeps();
    provider
      .mockResolvedValueOnce({ text: 'g', latencyMs: 1 })
      .mockRejectedValueOnce(new Error('gemini boom'))
      .mockResolvedValueOnce({ text: 'o', latencyMs: 3 });
    const resp = await handle(post({ use_case: 'triangulate', prompt: 'p' }), deps);
    expect(resp.status).toBe(200);
    expect(bumpCount()).toBe(3);
    expect(triangulateLog[0].gemini_resp).toMatch(/error: gemini boom/);
  });

  it('single-provider failure returns 502 and does not bump / log', async () => {
    const { deps, doubtLog, bumpCount, provider } = makeDeps();
    provider.mockRejectedValueOnce(new Error('groq offline'));
    const resp = await handle(post({ use_case: 'quick_explain', prompt: 'p' }), deps);
    expect(resp.status).toBe(502);
    expect(bumpCount()).toBe(0);
    expect(doubtLog).toHaveLength(0);
    const body = await resp.json();
    expect(body.error).toMatch(/groq offline/);
  });
});
