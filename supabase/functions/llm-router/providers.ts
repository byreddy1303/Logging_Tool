// Pure adapters for the four LLM providers we route to. No Deno globals —
// each fetcher takes a `fetchFn` so vitest can mock it. Provider choice per
// use-case, credit accounting, and daily cap all live here so the request
// handler can call them uniformly.

export type Provider = 'groq' | 'gemini' | 'openrouter' | 'cerebras';

export type LLMUseCase =
  | 'quick_explain'
  | 'deep_doubt'
  | 'triangulate'
  | 'long_context'
  | 'reflex_score'
  | 'variation'
  | 'formula_extract'
  | 'formula_extract_image';

export interface ProviderRoute {
  provider: Provider;
  model: string;
}

// BUILD.md §9.2 — verbatim.
export const ROUTES: Record<LLMUseCase, ProviderRoute | ProviderRoute[]> = {
  quick_explain: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  deep_doubt: { provider: 'gemini', model: 'gemini-2.5-pro' },
  triangulate: [
    { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    { provider: 'gemini', model: 'gemini-2.5-pro' },
    { provider: 'openrouter', model: 'deepseek/deepseek-r1' }
  ],
  long_context: { provider: 'gemini', model: 'gemini-2.5-flash' },
  reflex_score: { provider: 'cerebras', model: 'llama-3.3-70b' },
  variation: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  formula_extract: { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  formula_extract_image: { provider: 'gemini', model: 'gemini-2.5-flash' }
};

export const DAILY_LIMIT = 100;

// Triangulate fans out to three providers, so it's billed as three calls.
export function creditCost(useCase: LLMUseCase): number {
  return useCase === 'triangulate' ? 3 : 1;
}

export function wouldExceedLimit(
  currentCount: number,
  useCase: LLMUseCase,
  limit: number = DAILY_LIMIT
): boolean {
  return currentCount + creditCost(useCase) > limit;
}

export function nextResetIso(now: Date = new Date()): string {
  const t = new Date(now);
  t.setUTCDate(t.getUTCDate() + 1);
  t.setUTCHours(0, 0, 0, 0);
  return t.toISOString();
}

export interface CallResult {
  text: string;
  latencyMs: number;
}

export interface ProviderCallArgs {
  prompt: string;
  apiKey: string;
  model: string;
  fetchFn?: typeof fetch;
  // For deep_doubt: Gemini uses a "thinking" instruction as a system prefix.
  systemPrefix?: string;
  /** Base64-encoded image payload (no `data:` prefix). Only Gemini uses it. */
  imageBase64?: string;
  /** MIME type for `imageBase64`. Defaults to `image/jpeg`. */
  imageMimeType?: string;
}

type FetchLike = typeof fetch;

function pickFetch(fetchFn: FetchLike | undefined): FetchLike {
  return fetchFn ?? fetch;
}

// Groq (OpenAI-compatible chat completions).
export async function callGroq(args: ProviderCallArgs): Promise<CallResult> {
  const t0 = Date.now();
  const resp = await pickFetch(args.fetchFn)('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.systemPrefix
        ? [
            { role: 'system', content: args.systemPrefix },
            { role: 'user', content: args.prompt }
          ]
        : [{ role: 'user', content: args.prompt }],
      temperature: 0.2,
      max_tokens: 2048
    })
  });
  if (!resp.ok) throw new Error(`groq ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    latencyMs: Date.now() - t0
  };
}

// Gemini (Google generative language API). Vision-capable: pass an image via
// `imageBase64` + `imageMimeType` and it goes as an inline_data part alongside
// the text prompt.
export async function callGemini(args: ProviderCallArgs): Promise<CallResult> {
  const t0 = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent?key=${args.apiKey}`;
  const parts: Array<Record<string, unknown>> = [];
  if (args.imageBase64) {
    parts.push({
      inline_data: {
        mime_type: args.imageMimeType ?? 'image/jpeg',
        data: args.imageBase64
      }
    });
  }
  parts.push({ text: args.prompt });
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: args.imageBase64 ? 0 : 0.2,
      maxOutputTokens: args.imageBase64 ? 3072 : 2048
    }
  };
  if (args.systemPrefix) {
    body.systemInstruction = { role: 'system', parts: [{ text: args.systemPrefix }] };
  }
  const resp = await pickFetch(args.fetchFn)(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error(`gemini ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const geminiParts = data.candidates?.[0]?.content?.parts ?? [];
  const text = geminiParts.map((p) => p.text ?? '').join('');
  return { text, latencyMs: Date.now() - t0 };
}

// OpenRouter (OpenAI-compatible, model string like "deepseek/deepseek-r1").
export async function callOpenRouter(args: ProviderCallArgs): Promise<CallResult> {
  const t0 = Date.now();
  const resp = await pickFetch(args.fetchFn)('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://air-journal.app',
      'X-Title': 'AIR Journal'
    },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: 'user', content: args.prompt }],
      temperature: 0.2
    })
  });
  if (!resp.ok) throw new Error(`openrouter ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    latencyMs: Date.now() - t0
  };
}

// Cerebras (OpenAI-compatible, chosen for reflex_score latency).
export async function callCerebras(args: ProviderCallArgs): Promise<CallResult> {
  const t0 = Date.now();
  const resp = await pickFetch(args.fetchFn)('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: 'user', content: args.prompt }],
      temperature: 0,
      max_tokens: 32
    })
  });
  if (!resp.ok) throw new Error(`cerebras ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return {
    text: data.choices?.[0]?.message?.content ?? '',
    latencyMs: Date.now() - t0
  };
}

export type ProviderCall = (args: ProviderCallArgs) => Promise<CallResult>;

export const DEFAULT_PROVIDER_CALLS: Record<Provider, ProviderCall> = {
  groq: callGroq,
  gemini: callGemini,
  openrouter: callOpenRouter,
  cerebras: callCerebras
};

// deep_doubt reuses quick_explain's user prompt but the client MUST prepend
// "Think step-by-step before writing the final structured answer." per
// BUILD.md §9.1. That prefix is the only knob the router owns.
export function systemPrefixFor(useCase: LLMUseCase): string | undefined {
  return useCase === 'deep_doubt'
    ? 'Think step-by-step before writing the final structured answer.'
    : undefined;
}
