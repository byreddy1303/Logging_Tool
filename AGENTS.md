# AGENTS.md — Autonomy contract for building AIR Journal

**Read `BUILD.md` first. Every technical decision is in there. Do not ask the user for choices already made.**

## Your job
Execute `BUILD.md` §8 (sequential build order) end-to-end. Ship a working, deployed, multi-user PWA that meets §16 (Definition of Done).

## Rules
1. Build in the order given (`S01 → S44`). No skipping.
2. Commit after each `S` step. Message format: `S<NN>: <summary>` (e.g., `S02: Postgres migrations + RLS`).
3. After each phase (§7), run `npm run typecheck && npm run lint && npm run test`. All must pass before continuing.
4. Do not add features not in `BUILD.md`. If tempted, append one line to `FUTURE.md` and keep building.
5. When ambiguity hits: pick the simpler option, log to `DECISIONS.md`, continue. Do not stop.
6. Never call `git push --force`, `git reset --hard`, or `--no-verify` on the user's behalf.
7. Never break §17 hard bans. Never bypass §2 non-negotiables.
8. Report progress at end of each phase (not each file). Terse. What shipped, tests green, next phase.
9. When you finish `S44`, tag `v1.0.0` and stop. Do not keep adding.

## Repo state
- Root configs, tsconfig, tailwind, vite already scaffolded (see `BUILD.md` §14).
- All other files to be created.

## Reminder
This tool exists to compress the user's mistake surface for GATE 2027. Every design choice defers to that. When two options are equally correct, pick the one that:
1. Reduces user distraction
2. Requires less user attention to maintain
3. Ships faster

Anything else is a compulsion wearing a productive mask.
