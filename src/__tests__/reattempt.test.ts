// F3.3 DoD: ladder progression D3→D10→D30→MASTERED; failure resets to D3.
import { describe, it, expect, beforeEach } from 'vitest';
import type { ReattemptRow } from '@/types';
import { advance, needsReattempt, scheduleReattempt, recordReattemptResult } from '@/lib/reattempt';
import { db } from '@/lib/db';

const USER = '00000000-0000-4000-8000-000000000001';
const TODAY = '2026-07-17';

function ladderRow(stage: ReattemptRow['stage'], scheduled = TODAY): ReattemptRow {
  return {
    id: 'ra-1',
    user_id: USER,
    question_id: 'q-1',
    scheduled_date: scheduled,
    stage,
    history: [],
    created_at: '2026-07-14T09:00:00.000Z'
  };
}

describe('advance (pure ladder)', () => {
  it('progresses D3 → D10 → D30 → MASTERED on clean results', () => {
    let state = ladderRow('D3');
    let next = advance(state, 'clean', TODAY);
    expect(next.stage).toBe('D10');
    expect(next.scheduled_date).toBe('2026-07-27'); // +10d

    state = { ...state, ...next };
    next = advance(state, 'clean', TODAY);
    expect(next.stage).toBe('D30');
    expect(next.scheduled_date).toBe('2026-08-16'); // +30d

    state = { ...state, ...next };
    next = advance(state, 'clean', TODAY);
    expect(next.stage).toBe('MASTERED');
    // MASTERED keeps its last scheduled_date (SQL coalesce semantics)
    expect(next.scheduled_date).toBe('2026-08-16');
    expect(next.history.map((h) => h.result)).toEqual(['clean', 'clean', 'clean']);
  });

  it.each(['D3', 'D10', 'D30'] as const)('fail at %s resets to D3 at +3d', (stage) => {
    const next = advance(ladderRow(stage), 'fail', TODAY);
    expect(next.stage).toBe('D3');
    expect(next.scheduled_date).toBe('2026-07-20');
    expect(next.history).toEqual([{ date: TODAY, result: 'fail' }]);
  });

  it('clean on MASTERED stays MASTERED and keeps its date', () => {
    const next = advance(ladderRow('MASTERED', '2026-08-16'), 'clean', TODAY);
    expect(next.stage).toBe('MASTERED');
    expect(next.scheduled_date).toBe('2026-08-16');
  });
});

describe('needsReattempt', () => {
  it('is false for R, true for RBS/RBG and every W-*', () => {
    expect(needsReattempt('R')).toBe(false);
    for (const o of ['RBS', 'RBG', 'W-C', 'W-E', 'W-R'] as const) {
      expect(needsReattempt(o)).toBe(true);
    }
  });
});

describe('scheduling (Dexie-backed)', () => {
  beforeEach(async () => {
    await db.reattempts.clear();
  });

  it('creates a D3 row due today + 3', async () => {
    const row = await scheduleReattempt(USER, 'q-9', TODAY);
    expect(row?.stage).toBe('D3');
    expect(row?.scheduled_date).toBe('2026-07-20');
    const stored = await db.reattempts.get(row!.id);
    expect(stored?.sync_status).toBe('synced'); // sandbox: sync disabled in tests
  });

  it('does not duplicate an open ladder for the same question', async () => {
    await scheduleReattempt(USER, 'q-9', TODAY);
    const second = await scheduleReattempt(USER, 'q-9', TODAY);
    expect(second).toBeNull();
    expect(await db.reattempts.where('question_id').equals('q-9').count()).toBe(1);
  });

  it('recordReattemptResult persists the advanced row', async () => {
    const row = (await scheduleReattempt(USER, 'q-9', TODAY))!;
    const updated = await recordReattemptResult(row, 'clean', TODAY);
    expect(updated.stage).toBe('D10');
    const stored = await db.reattempts.get(row.id);
    expect(stored?.stage).toBe('D10');
    expect(stored?.history).toHaveLength(1);
  });
});
