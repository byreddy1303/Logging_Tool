import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import type { QuestionRow, SessionRow } from '@/types';
import { db } from '@/lib/db';
import {
  allSessions,
  finishedSessionsWithQuestions,
  pruneEmptyFinishedSessions,
  recentSessions
} from '@/lib/sessions';
import { stopSync } from '@/lib/sync';

const USER = '00000000-0000-4000-8000-000000000001';

function session(
  id: string,
  createdAt: string,
  actualDuration: number | null = 30
): SessionRow & { sync_status: 'synced' } {
  return {
    id,
    user_id: USER,
    date: createdAt.slice(0, 10),
    subject: 'Algorithms',
    target_duration_min: 60,
    actual_duration_min: actualDuration,
    insight: null,
    sadhana_done: false,
    interruptions_count: 0,
    created_at: createdAt,
    sync_status: 'synced'
  };
}

function question(id: string, sessionId: string): QuestionRow & { sync_status: 'synced' } {
  return {
    id,
    user_id: USER,
    session_id: sessionId,
    subject: 'Algorithms',
    subtopic: null,
    source_year: null,
    source_ref: null,
    question_text: null,
    answer_text: null,
    image_url: null,
    time_spent_sec: 60,
    target_time_sec: 120,
    outcome: 'R',
    pattern_name: null,
    trigger_sentence: null,
    root_cause: null,
    mark_decision: null,
    mark_correct: null,
    created_at: '2026-07-22T09:10:00.000Z',
    sync_status: 'synced'
  };
}

beforeEach(async () => {
  stopSync();
  await db.delete();
  await db.open();
});

describe('session history', () => {
  it('returns only finished sessions containing questions, newest first', async () => {
    await db.sessions.bulkPut([
      session('older-valid', '2026-07-20T09:00:00.000Z'),
      session('newer-valid', '2026-07-22T09:00:00.000Z'),
      session('empty-finished', '2026-07-23T09:00:00.000Z'),
      session('running', '2026-07-24T09:00:00.000Z', null)
    ]);
    await db.questions.bulkPut([
      question('q-1', 'older-valid'),
      question('q-2', 'newer-valid'),
      question('q-3', 'running')
    ]);

    expect((await finishedSessionsWithQuestions(USER)).map((row) => row.id)).toEqual([
      'newer-valid',
      'older-valid'
    ]);
    expect((await allSessions(USER)).map((row) => row.id)).toEqual(['newer-valid', 'older-valid']);
    expect((await recentSessions(USER, 1)).map((row) => row.id)).toEqual(['newer-valid']);
  });

  it('deletes legacy empty finished sessions but preserves running sessions', async () => {
    await db.sessions.bulkPut([
      session('valid', '2026-07-20T09:00:00.000Z'),
      session('empty-finished', '2026-07-22T09:00:00.000Z'),
      session('running', '2026-07-23T09:00:00.000Z', null)
    ]);
    await db.questions.put(question('q-1', 'valid'));

    expect(await pruneEmptyFinishedSessions(USER)).toBe(1);
    expect(await db.sessions.get('empty-finished')).toBeUndefined();
    expect(await db.sessions.get('running')).toBeDefined();
    expect(await db.sessions.get('valid')).toBeDefined();
  });
});
