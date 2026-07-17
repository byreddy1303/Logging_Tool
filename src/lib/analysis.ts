// Pure analysis helpers used by the Dashboard (F3.4) and Weekly Review (F5.1).
// Every function is deterministic, side-effect-free, and mirrors the semantics
// of the corresponding SQL queries the server would run.
import { subDays } from 'date-fns';
import type { Outcome, QuestionRow, ReattemptRow, SessionRow } from '@/types';
import { OUTCOMES } from '@/lib/constants';
import { todayISO } from '@/lib/utils';

/** Count of reattempts in an "open" state (not MASTERED). */
export function mistakeSurfaceOpen(reattempts: ReattemptRow[]): number {
  return reattempts.filter((r) => r.stage !== 'MASTERED').length;
}

/**
 * "Trend arrow" for mistake surface: this week's open count vs. one week ago.
 * We approximate the historical open count by walking each reattempt's history:
 * a card was "open at date D" iff created_at <= D and it hadn't reached MASTERED
 * by D. We don't have a mastered_at column, so we use the last history entry's
 * date when stage is MASTERED as a proxy.
 */
export function mistakeSurfaceTrend(
  reattempts: ReattemptRow[],
  now: Date = new Date()
): { current: number; prior: number; delta: number } {
  const current = reattempts.filter((r) => r.stage !== 'MASTERED').length;
  const asOf = subDays(now, 7).toISOString().slice(0, 10);
  const prior = reattempts.filter((r) => {
    if (r.created_at.slice(0, 10) > asOf) return false;
    if (r.stage !== 'MASTERED') return true;
    const last = r.history.at(-1);
    return !last || last.date > asOf; // still open a week ago
  }).length;
  return { current, prior, delta: current - prior };
}

/** Buckets a session's questions by outcome. Returns every outcome key even if 0. */
export function outcomeDistribution(questions: QuestionRow[]): Record<Outcome, number> {
  const empty = Object.fromEntries(OUTCOMES.map((o) => [o.code, 0])) as Record<Outcome, number>;
  for (const q of questions) empty[q.outcome] = (empty[q.outcome] ?? 0) + 1;
  return empty;
}

/** Newest session by created_at, or null. */
export function latestSession(sessions: SessionRow[]): SessionRow | null {
  if (sessions.length === 0) return null;
  return [...sessions].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
}

/** Reattempts due today or overdue and not yet mastered. */
export function dueTodayCount(reattempts: ReattemptRow[], today = todayISO()): number {
  return reattempts.filter((r) => r.stage !== 'MASTERED' && r.scheduled_date <= today).length;
}

/**
 * Consecutive days ending today on which any question was tagged. Used only as
 * a calm signal, never for streak gamification (§17 hard ban).
 */
export function activeDaysBack(questions: QuestionRow[], now: Date = new Date()): number {
  const dates = new Set(questions.map((q) => q.created_at.slice(0, 10)));
  let n = 0;
  let cursor = now;
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    n += 1;
    cursor = subDays(cursor, 1);
  }
  return n;
}
