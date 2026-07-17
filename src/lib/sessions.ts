// Session-level helpers: pruning empty sessions, listing recent sessions for
// the journal picker.
import type { SessionRow } from '@/types';
import { db } from '@/lib/db';
import { deleteLocal } from '@/lib/sync';

/**
 * Delete every finished session that has zero tagged questions. Runs cheaply
 * (one Dexie query + one count per candidate) — the intent is a one-shot
 * housekeeping sweep on Journal / Dashboard mount so old cruft disappears.
 * Returns the number of sessions dropped.
 */
export async function pruneEmptyFinishedSessions(userId: string): Promise<number> {
  if (!userId) return 0;
  const finished = await db.sessions
    .where('user_id')
    .equals(userId)
    .filter((s) => s.actual_duration_min !== null)
    .toArray();
  let dropped = 0;
  for (const s of finished) {
    const count = await db.questions.where('session_id').equals(s.id).count();
    if (count === 0) {
      await deleteLocal('sessions', s.id);
      dropped += 1;
    }
  }
  return dropped;
}

/** Newest-first list of the user's finished sessions, capped at `limit`. */
export async function recentSessions(userId: string, limit = 6): Promise<SessionRow[]> {
  if (!userId) return [];
  const all = await db.sessions
    .where('user_id')
    .equals(userId)
    .filter((s) => s.actual_duration_min !== null)
    .sortBy('created_at');
  return all.reverse().slice(0, limit);
}

/**
 * All the user's finished sessions (newest first). Used by the session filter
 * dropdown so the user can jump to any old session — not just the last 6.
 */
export async function allSessions(userId: string): Promise<SessionRow[]> {
  if (!userId) return [];
  const rows = await db.sessions
    .where('user_id')
    .equals(userId)
    .filter((s) => s.actual_duration_min !== null)
    .sortBy('created_at');
  return rows.reverse();
}
