// llm-router — proxies all LLM calls, enforces 100/user/day (BUILD.md §9).
// Full implementation lands in S18. This stub validates shape and returns 501.
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: { use_case?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }
  if (!body.use_case || !body.prompt) {
    return json({ error: 'use_case and prompt are required' }, 400);
  }
  return json({ error: 'not implemented yet (S18)' }, 501);
});
