import { describe, expect, it } from 'vitest';
import {
  BASELINE_OPEN_SURFACE,
  TARGET_PATTERN_LIBRARY,
  WEIGHTS,
  calibration,
  computeReadiness,
  coverage,
  readinessComponents,
  retention,
  surface
} from '@/lib/readiness';
import type { PatternRow, QuestionRow, ReattemptRow, Outcome, ReattemptStage } from '@/types';

function question(o: Partial<QuestionRow>): QuestionRow {
  return {
    id: o.id ?? 'q',
    user_id: 'u',
    session_id: null,
    subject: 'Discrete Mathematics',
    subtopic: null,
    source_year: null,
    source_ref: null,
    question_text: null,
    image_url: null,
    time_spent_sec: 0,
    target_time_sec: 120,
    outcome: (o.outcome ?? 'R') as Outcome,
    pattern_name: null,
    trigger_sentence: null,
    root_cause: null,
    mark_decision: o.mark_decision ?? null,
    mark_correct: o.mark_correct ?? null,
    created_at: '2026-07-18T00:00:00.000Z',
    ...o
  };
}

function reattempt(stage: ReattemptStage): ReattemptRow {
  return {
    id: `r-${Math.random()}`,
    user_id: 'u',
    question_id: 'q',
    scheduled_date: '2026-07-25',
    stage,
    history: [],
    created_at: '2026-07-18T00:00:00.000Z'
  };
}

function pattern(name: string): PatternRow {
  return {
    id: `p-${name}`,
    user_id: 'u',
    name,
    subject: 'Discrete Mathematics',
    count: 1,
    is_reflexed: false,
    mastery_level: 0,
    first_seen_at: '2026-07-18T00:00:00.000Z'
  };
}

describe('sub-scores', () => {
  it('coverage saturates at the target', () => {
    expect(coverage(0)).toBe(0);
    expect(coverage(TARGET_PATTERN_LIBRARY / 2)).toBeCloseTo(0.5, 3);
    expect(coverage(TARGET_PATTERN_LIBRARY)).toBe(1);
    expect(coverage(TARGET_PATTERN_LIBRARY * 2)).toBe(1);
  });

  it('retention is 0 with no re-attempts, 1 when all stabilised', () => {
    expect(retention([])).toBe(0);
    expect(retention([reattempt('D3'), reattempt('D10')])).toBe(0);
    expect(retention([reattempt('D30'), reattempt('MASTERED')])).toBe(1);
    expect(retention([reattempt('D3'), reattempt('MASTERED')])).toBeCloseTo(0.5, 3);
  });

  it('calibration only counts MARKed questions', () => {
    expect(calibration([])).toBe(0);
    const qs = [
      question({ mark_decision: 'MARK', mark_correct: true }),
      question({ mark_decision: 'MARK', mark_correct: false }),
      question({ mark_decision: 'SKIP', mark_correct: null }),
      question({ mark_decision: null, mark_correct: null })
    ];
    expect(calibration(qs)).toBeCloseTo(0.5, 3);
  });

  it('surface inverts open re-attempts against the baseline', () => {
    expect(surface(0)).toBe(1);
    expect(surface(BASELINE_OPEN_SURFACE / 2)).toBeCloseTo(0.5, 3);
    expect(surface(BASELINE_OPEN_SURFACE)).toBe(0);
    expect(surface(BASELINE_OPEN_SURFACE * 2)).toBe(0);
  });
});

describe('computeReadiness', () => {
  it('empty inputs → subscores 0 except surface (baseline unused = full mark)', () => {
    const r = computeReadiness({ questions: [], reattempts: [], patterns: [] });
    expect(r.coverage).toBe(0);
    expect(r.retention).toBe(0);
    expect(r.calibration).toBe(0);
    expect(r.surface).toBe(1); // 0 open reattempts → surface score 1
    // Only surface contributes: 1 * 0.20 * 100 = 20
    expect(r.score).toBe(20);
  });

  it('mixed synthetic data gives expected composite', () => {
    const patterns = Array.from({ length: 200 }, (_, i) => pattern(`p${i}`)); // 200/400 = 0.5
    const reattempts = [
      reattempt('D30'),
      reattempt('D30'),
      reattempt('MASTERED'),
      reattempt('D3') // 3/4 stabilised
    ];
    // open re-attempts (non-MASTERED) = 3; surface = 1 - 3/50 = 0.94
    const questions = [
      question({ mark_decision: 'MARK', mark_correct: true }),
      question({ mark_decision: 'MARK', mark_correct: true }),
      question({ mark_decision: 'MARK', mark_correct: false }),
      question({ mark_decision: 'MARK', mark_correct: false }) // 2/4 = 0.5
    ];
    const r = computeReadiness({ questions, reattempts, patterns });
    expect(r.coverage).toBeCloseTo(0.5, 3);
    expect(r.retention).toBeCloseTo(0.75, 3);
    expect(r.calibration).toBeCloseTo(0.5, 3);
    expect(r.surface).toBeCloseTo(0.94, 3);
    // expected score: 0.5*30 + 0.75*25 + 0.5*25 + 0.94*20 = 15 + 18.75 + 12.5 + 18.8 = 65.05 → 65
    expect(r.score).toBe(65);
  });

  it('counts breakdown numbers match inputs', () => {
    const r = computeReadiness({
      questions: [question({ mark_decision: 'MARK', mark_correct: true })],
      reattempts: [reattempt('D30')],
      patterns: [pattern('p1')]
    });
    expect(r.counts.patterns).toBe(1);
    expect(r.counts.stabilised).toBe(1);
    expect(r.counts.openReattempts).toBe(1); // D30 is still open (not MASTERED)
    expect(r.counts.markedDecisions).toBe(1);
    expect(r.counts.markedCorrect).toBe(1);
  });
});

describe('readinessComponents', () => {
  it('weights sum to 1', () => {
    const s = WEIGHTS.coverage + WEIGHTS.retention + WEIGHTS.calibration + WEIGHTS.surface;
    expect(s).toBeCloseTo(1, 6);
  });

  it('contributions sum to the total score (within rounding)', () => {
    const r = computeReadiness({
      questions: [
        question({ mark_decision: 'MARK', mark_correct: true }),
        question({ mark_decision: 'MARK', mark_correct: false })
      ],
      reattempts: [reattempt('D30'), reattempt('D3')],
      patterns: [pattern('a'), pattern('b')]
    });
    const cs = readinessComponents(r);
    const sum = cs.reduce((s, c) => s + c.contribution, 0);
    expect(Math.abs(sum - r.score)).toBeLessThanOrEqual(3); // rounding slack
  });
});
