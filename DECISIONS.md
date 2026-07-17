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
