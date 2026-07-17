# AIR Journal

Local-first, multi-user GATE PYQ analysis app. Captures every solved question as structured data (outcome / pattern / trigger / root cause), schedules spaced re-attempts, integrates free LLMs for doubt-clearing and variation generation, surfaces one weekly upstream weakness.

Built for GATE 2027 CS, targeting AIR <100.

## Quick start

```bash
npm install
cp .env.example .env.local        # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

# In another terminal:
npx supabase start                # local Postgres + Studio at http://localhost:54323

npm run dev                       # app at http://localhost:5173
```

## Docs

- [`BUILD.md`](./BUILD.md) — Master build specification. Everything technical lives here.
- [`CLAUDE.md`](./CLAUDE.md) — Autonomy contract for AI-assisted builds.
- [`FROZEN.md`](./FROZEN.md) — Feature-freeze commitment (2026-10-31).
- [`DECISIONS.md`](./DECISIONS.md) — Log of choices made mid-build.
- [`FUTURE.md`](./FUTURE.md) — Deferred features (do not build).

## Core philosophy

The tool compresses your mistake surface. It does not replace your reasoning.

- Every question you solve produces 4 tags (30 sec): outcome, pattern, trigger, root cause.
- Wrong / slow / guessed answers auto-enter a spaced re-attempt ladder (3 → 10 → 30 days).
- LLMs assist with doubt-clearing and variation generation. **LLMs never tag your data.**
- Weekly, you write ONE upstream weakness to fix that week. The tool shows its own guess only after you write yours.

## Stack

React 18 + Vite + TypeScript · Tailwind · Zustand · Dexie · React Query · Supabase (Postgres + Auth + Edge Functions) · Groq + Gemini + OpenRouter + Cerebras (all free tiers).

Total monthly cost for 2 users: ₹0.

## Deploy

See [`BUILD.md`](./BUILD.md) §12.

## License

Private.
