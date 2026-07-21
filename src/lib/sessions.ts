// Session-level helpers: pruning empty sessions, listing recent sessions for
// the journal picker.
import type { SessionRow } from '@/types';
import { db } from '@/lib/db';
import { deleteLocal } from '@/lib/sync';

/**
 * Finished sessions that contain at least one tagged question, newest first.
 * A single indexed question read builds the membership set, so Dashboard and
 * Journal never briefly promote an empty or still-running session.
 */
export async function finishedSessionsWithQuestions(userId: string): Promise<SessionRow[]> {
  if (!userId) return [];
  const [sessions, questions] = await Promise.all([
    db.sessions.where('user_id').equals(userId).toArray(),
    db.questions.where('user_id').equals(userId).toArray()
  ]);
  const populatedSessionIds = new Set(
    questions.flatMap((question) => (question.session_id ? [question.session_id] : []))
  );
  return sessions
    .filter(
      (session) =>
        session.actual_duration_min !== null && populatedSessionIds.has(session.id)
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Delete every finished session that has zero tagged questions. Runs cheaply
 * (one Dexie query + one count per candidate) — the intent is a one-shot
 * housekeeping sweep on Journal / Dashboard mount so old cruft disappears.
 * Returns the number of sessions dropped.
 */
export async function pruneEmptyFinishedSessions(userId: string): Promise<number> {
  if (!userId) return 0;
  const [finished, questions] = await Promise.all([
    db.sessions
      .where('user_id')
      .equals(userId)
      .filter((session) => session.actual_duration_min !== null)
      .toArray(),
    db.questions.where('user_id').equals(userId).toArray()
  ]);
  const populatedSessionIds = new Set(
    questions.flatMap((question) => (question.session_id ? [question.session_id] : []))
  );
  let dropped = 0;
  for (const session of finished) {
    if (!populatedSessionIds.has(session.id)) {
      await deleteLocal('sessions', session.id);
      dropped += 1;
    }
  }
  return dropped;
}

/** Newest-first list of the user's finished sessions, capped at `limit`. */
export async function recentSessions(userId: string, limit = 6): Promise<SessionRow[]> {
  const all = await finishedSessionsWithQuestions(userId);
  return all.slice(0, limit);
}

/**
 * All the user's finished sessions (newest first). Used by the session filter
 * dropdown so the user can jump to any old session — not just the last 6.
 */
export async function allSessions(userId: string): Promise<SessionRow[]> {
  return finishedSessionsWithQuestions(userId);
}
