# Decision log

Append-only log of choices made during build that were NOT pre-specified in `BUILD.md`. Include date, choice, alternatives considered, and reason.

Format:

```
## YYYY-MM-DD — <short title>
**Chose**: <option>
**Rejected**: <other options>
**Reason**: <one sentence>
```

---

## 2026-07-17 — Repo location
**Chose**: subfolder `air-journal/` inside existing `Random/` repo.
**Rejected**: standalone new repo.
**Reason**: user already has a `Random/` catch-all; migrating to standalone is trivial later if desired.

## 2026-07-17 — Package manager
**Chose**: npm.
**Rejected**: pnpm, yarn, bun.
**Reason**: ubiquitous, Vercel default, no lockfile drama.

## 2026-07-17 — Repo location (supersedes earlier entry)
**Chose**: standalone git repo at `GATE PREP/air-journal/`.
**Rejected**: subfolder of a `Random/` repo.
**Reason**: no `Random/` repo exists on this machine; the build contract requires per-step commits, so the app gets its own repo.

## 2026-07-17 — Local Node version
**Chose**: build with local Node 26 (spec says 20 LTS).
**Rejected**: installing nvm + Node 20 locally.
**Reason**: all tooling used is Node-20-compatible; Vercel deploy target stays Node 20. Zero user attention required.

## 2026-07-17 — Invite-only enforcement mechanism
**Chose**: GoTrue signup enabled; a BEFORE INSERT trigger on `auth.users` rejects signups without a valid invite token (first-ever account exempt as owner bootstrap). AFTER INSERT trigger provisions profile, consumes invite, pairs buddies. Google OAuth is sign-in only.
**Rejected**: `enable_signup=false` + a service-role `redeem-invite` edge function.
**Reason**: keeps enforcement fully server-side (F1.1) with no extra edge function and no service-role key in more places.

## 2026-07-17 — Client-generated UUID primary keys
**Chose**: `crypto.randomUUID()` client-side becomes the canonical Postgres PK.
**Rejected**: `local_id` remap table from BUILD.md §5.5.
**Reason**: offline-first inserts need stable ids for FK chains before sync; client UUIDs make remapping unnecessary (simpler, fewer failure modes).

## 2026-07-17 — Session question-count target is ephemeral
**Chose**: keep the F2.1 question-count choice in the Zustand session store only.
**Rejected**: adding a `question_count` column to `sessions`.
**Reason**: the locked schema (§5.1) has no such column; the count only shapes in-session progress display.

## 2026-07-17 — Dev-only local sandbox on Auth screen
**Chose**: when Supabase env is missing AND `import.meta.env.DEV`, Auth offers "Enter local sandbox" (Dexie-only synthetic user).
**Rejected**: blocking all UI work until Supabase credentials exist.
**Reason**: lets the whole app be built and visually verified offline; unreachable in production builds.

## 2026-07-17 — Buddy tables are online-only
**Chose**: buddy/shared tables (buddies, shared_insights, question_shares, study_rooms) read via React Query from Supabase; not mirrored in Dexie.
**Rejected**: full offline mirror of buddy data.
**Reason**: §4 only requires offline-first for the user's own solo flow; buddy features are inherently online (realtime presence).

## 2026-07-17 — Re-attempt advancement is computed client-side
F3.3 says the server calls `advance_reattempt(id, result)`. Doing that from the client would break offline-first (result taggable offline) and double-apply once the row upsert syncs. Instead the client applies an identical pure transition (`src/lib/reattempt.ts advance()`) and persists via the normal sync path; the SQL function remains for server-side jobs (nightly cron). Semantics are byte-identical, verified by reattempt.test.ts.
