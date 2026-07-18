// F5.3 — exam-day readiness score. Composite of four subscores; each is a
// [0..1] fraction, then weighted per §5.3. Pure math so the same function
// runs client-side (for immediate feedback) and inside compute-readiness.
import type { PatternRow, QuestionRow, ReattemptRow } from '@/types';

export const TARGET_PATTERN_LIBRARY = 400;
export const BASELINE_OPEN_SURFACE = 50;

export const WEIGHTS = {
  coverage: 0.3,
  retention: 0.25,
  calibration: 0.25,
  surface: 0.2
} as const;

export interface ReadinessInputs {
  questions: QuestionRow[];
  reattempts: ReattemptRow[];
  patterns: PatternRow[];
}

export interface ReadinessBreakdown {
  score: number; // 0..100 rounded
  coverage: number; // 0..1
  retention: number; // 0..1
  calibration: number; // 0..1
  surface: number; // 0..1
  counts: {
    patterns: number;
    totalReattempts: number;
    stabilised: number; // D30 + MASTERED
    openReattempts: number;
    markedDecisions: number;
    markedCorrect: number;
  };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Coverage: how much of the target library has been *encountered* at all. */
export function coverage(patternCount: number): number {
  return clamp01(patternCount / TARGET_PATTERN_LIBRARY);
}

/** Retention: fraction of re-attempts that reached D30 or MASTERED. */
export function retention(reattempts: ReattemptRow[]): number {
  if (reattempts.length === 0) return 0;
  const stabilised = reattempts.filter(
    (r) => r.stage === 'D30' || r.stage === 'MASTERED'
  ).length;
  return clamp01(stabilised / reattempts.length);
}

/** Calibration: accuracy of MARK decisions (only counts questions actually MARK'd). */
export function calibration(questions: QuestionRow[]): number {
  const marked = questions.filter((q) => q.mark_decision === 'MARK');
  if (marked.length === 0) return 0;
  const correct = marked.filter((q) => q.mark_correct === true).length;
  return clamp01(correct / marked.length);
}

/** Surface: inverse of open re-attempts against a baseline. Small surface → high score. */
export function surface(openReattemptCount: number): number {
  return clamp01(1 - openReattemptCount / BASELINE_OPEN_SURFACE);
}

export function computeReadiness(inputs: ReadinessInputs): ReadinessBreakdown {
  const cov = coverage(inputs.patterns.length);
  const ret = retention(inputs.reattempts);
  const cal = calibration(inputs.questions);
  const openReattempts = inputs.reattempts.filter((r) => r.stage !== 'MASTERED').length;
  const surf = surface(openReattempts);
  const score = Math.round(
    (cov * WEIGHTS.coverage +
      ret * WEIGHTS.retention +
      cal * WEIGHTS.calibration +
      surf * WEIGHTS.surface) *
      100
  );
  const marked = inputs.questions.filter((q) => q.mark_decision === 'MARK');
  return {
    score,
    coverage: cov,
    retention: ret,
    calibration: cal,
    surface: surf,
    counts: {
      patterns: inputs.patterns.length,
      totalReattempts: inputs.reattempts.length,
      stabilised: inputs.reattempts.filter((r) => r.stage === 'D30' || r.stage === 'MASTERED').length,
      openReattempts,
      markedDecisions: marked.length,
      markedCorrect: marked.filter((q) => q.mark_correct === true).length
    }
  };
}

export type ReadinessComponentKey = 'coverage' | 'retention' | 'calibration' | 'surface';

export interface ReadinessComponent {
  key: ReadinessComponentKey;
  label: string;
  hint: string;
  weight: number;
  value: number;
  contribution: number; // rounded to nearest int
}

export function readinessComponents(b: ReadinessBreakdown): ReadinessComponent[] {
  return [
    {
      key: 'coverage',
      label: 'Coverage',
      hint: `${b.counts.patterns} / ${TARGET_PATTERN_LIBRARY} patterns encountered`,
      weight: WEIGHTS.coverage,
      value: b.coverage,
      contribution: Math.round(b.coverage * WEIGHTS.coverage * 100)
    },
    {
      key: 'retention',
      label: 'Retention',
      hint: `${b.counts.stabilised} of ${b.counts.totalReattempts} at D30 / mastered`,
      weight: WEIGHTS.retention,
      value: b.retention,
      contribution: Math.round(b.retention * WEIGHTS.retention * 100)
    },
    {
      key: 'calibration',
      label: 'Calibration',
      hint:
        b.counts.markedDecisions === 0
          ? 'no MARK decisions logged yet'
          : `${b.counts.markedCorrect} / ${b.counts.markedDecisions} MARKs were right`,
      weight: WEIGHTS.calibration,
      value: b.calibration,
      contribution: Math.round(b.calibration * WEIGHTS.calibration * 100)
    },
    {
      key: 'surface',
      label: 'Mistake surface',
      hint: `${b.counts.openReattempts} open re-attempts (baseline ${BASELINE_OPEN_SURFACE})`,
      weight: WEIGHTS.surface,
      value: b.surface,
      contribution: Math.round(b.surface * WEIGHTS.surface * 100)
    }
  ];
}
