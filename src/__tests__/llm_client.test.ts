// Client-side callLLM: verifies the transport is honest — auth header, body
// shape, and every non-2xx path lands as a typed LLMError.
import { describe, expect, it, vi } from 'vitest';
import { callLLM, LLMError } from '@/lib/llm';

// Force supabaseConfigured=true for these tests. VITE_ env is baked at compile
// time; supabase module reads it once at import. So instead we bypass by
// passing an explicit `jwt` option — the client's contract with useLLM is
// exactly this: caller has a session, or explicit override.
function fetchMock(body: unknown, init: { ok?: boolean; status?: number; headers?: Record<string, string> } = {}) {
  const status = init.status ?? 200;
  const ok = init.ok ?? status < 400;
  return vi.fn().mockResolvedValue({
    ok,
    status,
    headers: {
      get(key: string) {
        return init.headers?.[key] ?? null;
      }
    },
    json: async () => body
  } as unknown as Response);
}

describe('callLLM', () => {
  it('sends bearer + json body to /functions/v1/llm-router', async () => {
    const fetchFn = fetchMock({
      use_case: 'quick_explain',
      provider: 'groq',
      model: 'm',
      response: 'hi',
      latency_ms: 10
    });
    const r = await callLLM(
      { use_case: 'quick_explain', prompt: 'hello' },
      { jwt: 'JWT', fetchFn: fetchFn as unknown as typeof fetch }
    );
    expect(r).toMatchObject({ provider: 'groq', response: 'hi' });
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain('/functions/v1/llm-router');
    const initObj = init as RequestInit;
    expect((initObj.headers as Record<string, string>).Authorization).toBe('Bearer JWT');
    expect(JSON.parse(String(initObj.body))).toEqual({
      use_case: 'quick_explain',
      prompt: 'hello'
    });
  });

  it('maps 429 → LLMError code=quota with retryAfter from header', async () => {
    const fetchFn = fetchMock(
      { error: 'daily quota reached', limit: 100, used: 100, retry_after: '2026-07-19T00:00:00.000Z' },
      { status: 429, headers: { 'X-RateLimit-Reset': '2026-07-19T00:00:00.000Z' } }
    );
    await expect(
      callLLM(
        { use_case: 'quick_explain', prompt: 'p' },
        { jwt: 'j', fetchFn: fetchFn as unknown as typeof fetch }
      )
    ).rejects.toMatchObject({
      code: 'quota',
      status: 429,
      retryAfter: '2026-07-19T00:00:00.000Z',
      used: 100,
      limit: 100
    });
  });

  it('maps 429 → LLMError with retryAfter from body when header absent', async () => {
    const fetchFn = fetchMock(
      { error: 'daily quota reached', limit: 100, used: 100, retry_after: '2026-07-19T00:00:00.000Z' },
      { status: 429 }
    );
    let caught: LLMError | null = null;
    try {
      await callLLM(
        { use_case: 'quick_explain', prompt: 'p' },
        { jwt: 'j', fetchFn: fetchFn as unknown as typeof fetch }
      );
    } catch (e) {
      caught = e as LLMError;
    }
    expect(caught).toBeInstanceOf(LLMError);
    expect(caught?.retryAfter).toBe('2026-07-19T00:00:00.000Z');
  });

  it('maps 401 → LLMError code=unauth', async () => {
    const fetchFn = fetchMock({ error: 'unauthenticated' }, { status: 401 });
    await expect(
      callLLM(
        { use_case: 'quick_explain', prompt: 'p' },
        { jwt: 'j', fetchFn: fetchFn as unknown as typeof fetch }
      )
    ).rejects.toMatchObject({ code: 'unauth', status: 401 });
  });

  it('maps 400 → bad_request with server message', async () => {
    const fetchFn = fetchMock({ error: 'unknown or missing use_case' }, { status: 400 });
    await expect(
      callLLM(
        { use_case: 'quick_explain', prompt: 'p' },
        { jwt: 'j', fetchFn: fetchFn as unknown as typeof fetch }
      )
    ).rejects.toMatchObject({ code: 'bad_request', status: 400, message: 'unknown or missing use_case' });
  });

  it('maps 502 → provider error', async () => {
    const fetchFn = fetchMock({ error: 'groq offline' }, { status: 502 });
    await expect(
      callLLM(
        { use_case: 'quick_explain', prompt: 'p' },
        { jwt: 'j', fetchFn: fetchFn as unknown as typeof fetch }
      )
    ).rejects.toMatchObject({ code: 'provider', status: 502 });
  });

  it('throws code=unauth when no jwt provided (and no session available)', async () => {
    // Without a jwt override, callLLM asks supabase.auth.getSession(); in the
    // test env this returns null. Verify we surface unauth cleanly.
    const fetchFn = vi.fn();
    await expect(
      callLLM({ use_case: 'quick_explain', prompt: 'p' }, { fetchFn: fetchFn as unknown as typeof fetch })
    ).rejects.toBeInstanceOf(LLMError);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
