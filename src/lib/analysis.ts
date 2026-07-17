// Pure analysis helpers used by the Dashboard (F3.4) and Weekly Review (F5.1).
// Every function is deterministic, side-effect-free, and mirrors the semantics
// of the corresponding SQL queries the server would run.
import { subDays } from 'date-fns';
import type { Outcome, QuestionRow, ReattemptRow, RootCause, SessionRow } from '@/types';
import { OUTCOMES } from '@/lib/constants';
import { addDaysISO, todayISO, weekStartISO } from '@/lib/utils';

export interface WeeklyDraft {
  root_cause_summary: string;
  weakest_concept: string;
  this_weeks_fix: string;
}

/** Concat-hash of the three required narratives — used to detect unsaved edits. */
export function weeklyDraftFingerprint(d: WeeklyDraft): string {
  return `${d.root_cause_summary.trim()}::${d.weakest_concept.trim()}::${d.this_weeks_fix.trim()}`;
}

/**
 * F5.1 step 5 gate: LLM synthesis stays locked until all three narrative
 * fields are non-empty AND the persisted row (fingerprint) matches the
 * current draft. Editing after unlock re-locks the pane.
 */
export function synthesisUnlocked(draft: WeeklyDraft, savedFingerprint: string | null): boolean {
  const filled =
    draft.root_cause_summary.trim() !== '' &&
    draft.weakest_concept.trim() !== '' &&
    draft.this_weeks_fix.trim() !== '';
  if (!filled) return false;
  return savedFingerprint === weeklyDraftFingerprint(draft);
}

export interface WeeklyDataSummary {
  weekStart: string;
  weekEnd: string;
  totalQ: number;
  clean: number; // R
  slow: number; // RBS
  guess: number; // RBG
  wrong: number; // W-*
  bySubject: { subject: string; count: number; wrongish: number }[];
  byOutcome: Record<Outcome, number>;
  byRootCause: Partial<Record<RootCause, number>>;
  topPatterns: { name: string; count: number }[];
}

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
 * Aggregate a week's tagged questions into the summary used by F5.1 step 1
 * ("this week's data") and the LLM synthesis prompt in step 5.
 */
export function summarizeWeek(
  allQuestions: QuestionRow[],
  weekStart: string = weekStartISO()
): WeeklyDataSummary {
  const weekEnd = addDaysISO(weekStart, 6);
  const inWeek = allQuestions.filter((q) => {
    const day = q.created_at.slice(0, 10);
    return day >= weekStart && day <= weekEnd;
  });
  const byOutcome = Object.fromEntries(OUTCOMES.map((o) => [o.code, 0])) as Record<Outcome, number>;
  const byRootCause: Partial<Record<RootCause, number>> = {};
  const subjMap = new Map<string, { count: number; wrongish: number }>();
  const patternMap = new Map<string, number>();
  for (const q of inWeek) {
    byOutcome[q.outcome] = (byOutcome[q.outcome] ?? 0) + 1;
    if (q.root_cause) byRootCause[q.root_cause] = (byRootCause[q.root_cause] ?? 0) + 1;
    const s = subjMap.get(q.subject) ?? { count: 0, wrongish: 0 };
    s.count += 1;
    if (q.outcome !== 'R') s.wrongish += 1;
    subjMap.set(q.subject, s);
    if (q.pattern_name) patternMap.set(q.pattern_name, (patternMap.get(q.pattern_name) ?? 0) + 1);
  }
  const wrong = byOutcome['W-C'] + byOutcome['W-E'] + byOutcome['W-R'];
  return {
    weekStart,
    weekEnd,
    totalQ: inWeek.length,
    clean: byOutcome['R'],
    slow: byOutcome['RBS'],
    guess: byOutcome['RBG'],
    wrong,
    bySubject: [...subjMap.entries()]
      .map(([subject, v]) => ({ subject, ...v }))
      .sort((a, b) => b.wrongish - a.wrongish || b.count - a.count),
    byOutcome,
    byRootCause,
    topPatterns: [...patternMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  };
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
