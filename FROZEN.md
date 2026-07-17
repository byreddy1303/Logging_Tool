# Feature freeze

**Effective date: 2026-10-31**

After this date, the following operations are BLOCKED at the git pre-commit hook:

- Any commit touching `src/pages/` unless message starts with `fix:`
- Any commit touching `src/components/` unless message starts with `fix:`
- Any commit touching `supabase/migrations/` unless message starts with `fix:`

This is enforced by `.githooks/pre-commit` (installed automatically via `npm run prepare`).

## Why this exists

By Nov 1, 2026, the tool is done. The remaining 3 months to GATE 2027 are for using the tool — solving PYQs, tagging, Sunday reviews, re-attempts — not for coding features.

Adding features to your own study tool in Dec/Jan is not productivity. It is compulsion wearing a productive mask.

If a real bug blocks study, prefix the commit `fix:` and merge. That's it.

## Bypassing

Do not bypass. There is no `--force`, `--no-verify` allowed. If you catch yourself trying to bypass this hook, that is the signal to close the laptop and open a PYQ paper.

## After GATE

After Feb 2027, delete this file if you want. Until then, it stays.
