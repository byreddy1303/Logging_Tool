// compute-readiness — weekly cron (Mon 04:00 UTC). Recomputes the composite
// readiness score per user (BUILD.md §7 F5.3). Full implementation lands in S27.
import { json } from '../_shared/cors.ts';

Deno.serve(async (_req: Request) => {
  return json({ ok: true, users: 0, note: 'stub — implemented in S27' });
});
