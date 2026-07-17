// F3.4 DoD: numbers match the SQL semantics.
import { describe, it, expect } from 'vitest';
import type { QuestionRow, ReattemptRow, SessionRow } from '@/types';
import {
  dueTodayCount,
  latestSession,
  mistakeSurfaceOpen,
  mistakeSurfaceTrend,
  outcomeDistribution,
  activeDaysBack,
  summarizeWeek,
  synthesisUnlocked,
  weeklyDraftFingerprint,
  type WeeklyDraft
} from '@/lib/analysis';

const USER = '00000000-0000-4000-8000-000000000001';

function q(overrides: Partial<QuestionRow>): QuestionRow {
  return {
    id: 'q-x',
    user_id: USER,
    session_id: null,
    subject: 'Databases',
    subtopic: null,
    source_year: null,
    source_ref: null,
    question_text: null,
    image_url: null,
    time_spent_sec: 60,
    target_time_sec: 120,
    outcome: 'R',
    pattern_name: null,
    trigger_sentence: null,
    root_cause: null,
    mark_decision: null,
    mark_correct: null,
    created_at: '2026-07-17T09:00:00.000Z',
    ...overrides
  };
}

function ra(overrides: Partial<ReattemptRow>): ReattemptRow {
  return {
    id: 'ra-x',
    user_id: USER,
    question_id: 'q-x',
    scheduled_date: '2026-07-17',
    stage: 'D3',
    history: [],
    created_at: '2026-07-14T09:00:00.000Z',
    ...overrides
  };
}

describe('mistakeSurfaceOpen', () => {
  it('counts everything not MASTERED', () => {
    const rows = [ra({ stage: 'D3' }), ra({ stage: 'D10' }), ra({ stage: 'MASTERED' })];
    expect(mistakeSurfaceOpen(rows)).toBe(2);
  });

  it('returns 0 for empty input', () => {
    expect(mistakeSurfaceOpen([])).toBe(0);
  });
});

describe('mistakeSurfaceTrend', () => {
  const now = new Date('2026-07-17T12:00:00Z');

  it('current = open now; prior = open 7 days ago', () => {
    const rows = [
      ra({ stage: 'D3', created_at: '2026-07-01T09:00:00.000Z' }),
      ra({
        stage: 'MASTERED',
        created_at: '2026-06-01T09:00:00.000Z',
        history: [{ date: '2026-07-15', result: 'clean' }]
      })
    ];
    const t = mistakeSurfaceTrend(rows, now);
    expect(t.current).toBe(1);
    expect(t.prior).toBe(2);
    expect(t.delta).toBe(-1);
  });

  it('rows created after the as-of date don\'t count in prior', () => {
    const rows = [ra({ stage: 'D3', created_at: '2026-07-15T09:00:00.000Z' })];
    const t = mistakeSurfaceTrend(rows, now);
    expect(t.current).toBe(1);
    expect(t.prior).toBe(0);
  });
});

describe('outcomeDistribution', () => {
  it('buckets by outcome and zero-fills the rest', () => {
    const rows = [q({ outcome: 'R' }), q({ outcome: 'R' }), q({ outcome: 'W-C' })];
    const dist = outcomeDistribution(rows);
    expect(dist['R']).toBe(2);
    expect(dist['W-C']).toBe(1);
    expect(dist['RBS']).toBe(0);
    expect(dist['MSQ' as never]).toBeUndefined();
  });
});

describe('latestSession', () => {
  it('picks newest by created_at', () => {
    const older: SessionRow = {
      id: 's-1',
      user_id: USER,
      date: '2026-07-15',
      subject: 'Algorithms',
      target_duration_min: 60,
      actual_duration_min: 60,
      insight: null,
      sadhana_done: false,
      interruptions_count: 0,
      created_at: '2026-07-15T09:00:00.000Z'
    };
    const newer: SessionRow = { ...older, id: 's-2', created_at: '2026-07-17T09:00:00.000Z' };
    expect(latestSession([older, newer])?.id).toBe('s-2');
  });

  it('returns null for empty', () => {
    expect(latestSession([])).toBeNull();
  });
});

describe('dueTodayCount', () => {
  it('counts scheduled <= today and stage != MASTERED', () => {
    const rows = [
      ra({ scheduled_date: '2026-07-15' }),
      ra({ scheduled_date: '2026-07-17' }),
      ra({ scheduled_date: '2026-07-20' }),
      ra({ scheduled_date: '2026-07-15', stage: 'MASTERED' })
    ];
    expect(dueTodayCount(rows, '2026-07-17')).toBe(2);
  });
});

describe('summarizeWeek', () => {
  const weekStart = '2026-07-13'; // Monday
  it('buckets in-week questions and skips out-of-window rows', () => {
    const rows = [
      q({ outcome: 'R', subject: 'Algorithms', created_at: '2026-07-13T09:00:00.000Z' }),
      q({ outcome: 'RBS', subject: 'Algorithms', created_at: '2026-07-14T09:00:00.000Z' }),
      q({ outcome: 'W-C', subject: 'Databases', created_at: '2026-07-15T09:00:00.000Z' }),
      q({ outcome: 'W-C', subject: 'Databases', created_at: '2026-07-16T09:00:00.000Z' }),
      // out of window
      q({ outcome: 'R', subject: 'Algorithms', created_at: '2026-07-06T09:00:00.000Z' })
    ];
    const s = summarizeWeek(rows, weekStart);
    expect(s.totalQ).toBe(4);
    expect(s.clean).toBe(1);
    expect(s.slow).toBe(1);
    expect(s.wrong).toBe(2);
    expect(s.bySubject[0].subject).toBe('Databases'); // most wrongish first
    expect(s.bySubject[0].wrongish).toBe(2);
    expect(s.weekEnd).toBe('2026-07-19'); // +6 days
  });

  it('counts root causes and top patterns', () => {
    const rows = [
      q({
        outcome: 'W-C',
        root_cause: 'concept',
        pattern_name: 'joins on nulls',
        created_at: '2026-07-13T09:00:00.000Z'
      }),
      q({
        outcome: 'W-C',
        root_cause: 'concept',
        pattern_name: 'joins on nulls',
        created_at: '2026-07-14T09:00:00.000Z'
      }),
      q({
        outcome: 'RBS',
        root_cause: 'strategy',
        pattern_name: 'set cover',
        created_at: '2026-07-15T09:00:00.000Z'
      })
    ];
    const s = summarizeWeek(rows, weekStart);
    expect(s.byRootCause.concept).toBe(2);
    expect(s.byRootCause.strategy).toBe(1);
    expect(s.topPatterns[0]).toEqual({ name: 'joins on nulls', count: 2 });
  });
});

describe('synthesisUnlocked (F5.1 DoD)', () => {
  const filled: WeeklyDraft = {
    root_cause_summary: 'I overtrust reflex on identity questions.',
    weakest_concept: 'Set-associative caches',
    this_weeks_fix: 'Re-derive the three GATE 2020 cache Qs from scratch.'
  };
  it('stays locked while any of the three narratives is empty', () => {
    const empty = { root_cause_summary: '', weakest_concept: '', this_weeks_fix: '' };
    expect(synthesisUnlocked(empty, null)).toBe(false);
    expect(
      synthesisUnlocked({ ...filled, this_weeks_fix: '' }, weeklyDraftFingerprint(filled))
    ).toBe(false);
  });
  it('stays locked when the draft has drifted since save', () => {
    const saved = weeklyDraftFingerprint(filled);
    const edited = { ...filled, this_weeks_fix: 'different plan' };
    expect(synthesisUnlocked(edited, saved)).toBe(false);
  });
  it('unlocks when all three fields are filled AND the saved fingerprint matches', () => {
    expect(synthesisUnlocked(filled, weeklyDraftFingerprint(filled))).toBe(true);
  });
  it('whitespace-only fields count as empty', () => {
    const junk = { ...filled, weakest_concept: '   ' };
    expect(synthesisUnlocked(junk, weeklyDraftFingerprint(junk))).toBe(false);
  });
});

describe('activeDaysBack', () => {
  it('counts consecutive days ending today with any tagged question', () => {
    const now = new Date('2026-07-17T12:00:00Z');
    const rows = [
      q({ created_at: '2026-07-17T09:00:00.000Z' }),
      q({ created_at: '2026-07-16T09:00:00.000Z' }),
      q({ created_at: '2026-07-14T09:00:00.000Z' })
    ];
    expect(activeDaysBack(rows, now)).toBe(2); // 17, 16 (15 missing breaks the chain)
  });

  it('returns 0 when today has none', () => {
    const now = new Date('2026-07-17T12:00:00Z');
    const rows = [q({ created_at: '2026-07-15T09:00:00.000Z' })];
    expect(activeDaysBack(rows, now)).toBe(0);
  });
});
