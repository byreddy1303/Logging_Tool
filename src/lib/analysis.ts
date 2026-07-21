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
 * ("this week's data") and the learner's weekly review.
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

export interface CalibrationRow {
  subject: string;
  marked: number;
  markedCorrect: number;
  markedWrong: number;
  skipped: number;
  fiftyFifty: number;
  fiftyFiftyCorrect: number;
  accuracy: number | null; // null when no marks made
  expectedValue: number; // per-question EV over this subject's non-skips
  recommendation: 'raise' | 'lower' | 'hold';
}

/**
 * F5.4 — per-subject calibration. Under GATE's -1/3 negative marking:
 *   skip → 0, MARK correct → +1, MARK wrong → -1/3, 50-50 correct → +1,
 *   50-50 wrong → -1/3 (same payoff as MARK since answer is committed).
 * Recommendation:
 *   - accuracy < 40% and EV < 0  → raise threshold (skip more)
 *   - accuracy > 80% and EV > 0.6 → lower threshold (mark more)
 *   - else → hold
 */
export function calibrationBySubject(questions: QuestionRow[]): CalibrationRow[] {
  const per = new Map<string, CalibrationRow>();
  for (const q of questions) {
    if (!q.mark_decision) continue;
    let row = per.get(q.subject);
    if (!row) {
      row = {
        subject: q.subject,
        marked: 0,
        markedCorrect: 0,
        markedWrong: 0,
        skipped: 0,
        fiftyFifty: 0,
        fiftyFiftyCorrect: 0,
        accuracy: null,
        expectedValue: 0,
        recommendation: 'hold'
      };
      per.set(q.subject, row);
    }
    if (q.mark_decision === 'SKIP') {
      row.skipped += 1;
    } else if (q.mark_decision === 'MARK') {
      row.marked += 1;
      if (q.mark_correct === true) row.markedCorrect += 1;
      else if (q.mark_correct === false) row.markedWrong += 1;
    } else if (q.mark_decision === 'FIFTY_FIFTY') {
      row.fiftyFifty += 1;
      if (q.mark_correct === true) row.fiftyFiftyCorrect += 1;
    }
  }
  for (const row of per.values()) {
    const decided = row.marked + row.fiftyFifty;
    const correct = row.markedCorrect + row.fiftyFiftyCorrect;
    const wrong = decided - correct;
    if (row.marked > 0) row.accuracy = row.markedCorrect / row.marked;
    row.expectedValue = decided === 0 ? 0 : (correct * 1 + wrong * (-1 / 3)) / decided;
    // Under GATE −1/3 marking, break-even is at 25% accuracy. Anything below
    // that is a guaranteed money-loser; anything above 80% is leaving points
    // on the table. Sample size < 4 stays as "hold" to avoid twitchy advice.
    if (decided < 4) {
      row.recommendation = 'hold';
    } else if (row.accuracy != null && row.accuracy < 0.25) {
      row.recommendation = 'raise';
    } else if (row.accuracy != null && row.accuracy > 0.8 && row.expectedValue > 0.6) {
      row.recommendation = 'lower';
    } else {
      row.recommendation = 'hold';
    }
  }
  return [...per.values()].sort(
    (a, b) => a.expectedValue - b.expectedValue || b.marked - a.marked
  );
}

/** Aggregate all-subject EV given the per-subject rows. */
export function calibrationOverall(rows: CalibrationRow[]): {
  decided: number;
  correct: number;
  wrong: number;
  skipped: number;
  expectedValue: number;
  accuracy: number | null;
} {
  let decided = 0;
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let markedAll = 0;
  let markedCorrectAll = 0;
  for (const r of rows) {
    decided += r.marked + r.fiftyFifty;
    correct += r.markedCorrect + r.fiftyFiftyCorrect;
    wrong += r.markedWrong + (r.fiftyFifty - r.fiftyFiftyCorrect);
    skipped += r.skipped;
    markedAll += r.marked;
    markedCorrectAll += r.markedCorrect;
  }
  return {
    decided,
    correct,
    wrong,
    skipped,
    expectedValue: decided === 0 ? 0 : (correct * 1 + wrong * (-1 / 3)) / decided,
    accuracy: markedAll === 0 ? null : markedCorrectAll / markedAll
  };
}

export interface HeatmapCell {
  subject: string;
  subtopic: string | null;
  rootCause: RootCause | 'unspecified';
  count: number;
}

/** True for outcomes that count as "mistake surface" — the weakness heatmap only shows these. */
export function isMistake(outcome: Outcome): boolean {
  return outcome !== 'R';
}

/**
 * F5.2 — buckets mistake-surface questions into (subject × subtopic × root_cause) cells.
 * `groupBySubtopic=false` collapses subtopic to null so the heatmap can render at
 * subject granularity when the user prefers a bigger picture.
 */
export function heatmapCells(
  questions: QuestionRow[],
  {
    from,
    to,
    groupBySubtopic = true
  }: { from?: string; to?: string; groupBySubtopic?: boolean } = {}
): HeatmapCell[] {
  const buckets = new Map<string, HeatmapCell>();
  for (const q of questions) {
    if (!isMistake(q.outcome)) continue;
    const day = q.created_at.slice(0, 10);
    if (from && day < from) continue;
    if (to && day > to) continue;
    const subtopic = groupBySubtopic ? q.subtopic : null;
    const cause: RootCause | 'unspecified' = q.root_cause ?? 'unspecified';
    const key = `${q.subject}||${subtopic ?? ''}||${cause}`;
    const cell = buckets.get(key) ?? { subject: q.subject, subtopic, rootCause: cause, count: 0 };
    cell.count += 1;
    buckets.set(key, cell);
  }
  return [...buckets.values()].sort((a, b) => b.count - a.count);
}

/** Row totals per (subject × subtopic) — used to color the "worst row" header. */
export function heatmapRowTotals(cells: HeatmapCell[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const c of cells) {
    const key = `${c.subject}||${c.subtopic ?? ''}`;
    totals.set(key, (totals.get(key) ?? 0) + c.count);
  }
  return totals;
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
