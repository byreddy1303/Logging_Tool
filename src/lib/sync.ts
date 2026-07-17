// Local-first sync engine (BUILD.md §4, F1.3).
// UI writes go to Dexie synchronously via writeLocal(); a background push
// upserts pending rows to Supabase in FK-safe order with exponential backoff.
// Pulls merge server rows into Dexie; local rows still pending always win.
import { db, table, SYNCED_TABLES, type SyncedTableName } from '@/lib/db';
import { supabase, supabaseConfigured } from '@/lib/supabase';

interface QueuedDelete {
  table: SyncedTableName;
  id: string;
}

let syncEnabled = false;
let started = false;
let pushing = false;
let backoffMs = 2000;
let pushTimer: ReturnType<typeof setTimeout> | undefined;
let lastPullAt = 0;
let currentUserId: string | null = null;

const BACKOFF_MAX_MS = 60_000;
const PULL_MIN_GAP_MS = 30_000;

export function isSyncEnabled(): boolean {
  return syncEnabled;
}

/** Write a row locally (source of truth) and schedule a background push. */
export async function writeLocal<T extends { id: string }>(
  name: SyncedTableName,
  row: T
): Promise<void> {
  await table(name).put({ ...row, sync_status: syncEnabled ? 'pending' : 'synced' });
  if (syncEnabled) schedulePush(0);
}

/** Delete locally now; queue the remote delete if we cannot reach the server. */
export async function deleteLocal(name: SyncedTableName, id: string): Promise<void> {
  await table(name).delete(id);
  if (!syncEnabled) return;
  const queue = ((await db.meta.get('delete_queue'))?.value as QueuedDelete[] | undefined) ?? [];
  await db.meta.put({ key: 'delete_queue', value: [...queue, { table: name, id }] });
  schedulePush(0);
}

function schedulePush(delayMs: number) {
  if (!syncEnabled) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void flushPushQueue(), delayMs);
}

/** Push every pending row (and queued deletes). Exposed for tests + listeners. */
export async function flushPushQueue(): Promise<void> {
  if (!syncEnabled || pushing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  pushing = true;
  let hadError = false;
  try {
    for (const name of SYNCED_TABLES) {
      const rows = await table(name).where('sync_status').anyOf('pending', 'error').toArray();
      if (rows.length === 0) continue;
      const payload = rows.map(({ sync_status: _s, ...rest }) => rest);
      const { error } = await supabase.from(name).upsert(payload);
      if (error) {
        hadError = true;
        console.warn(`[sync] push failed for ${name}: ${error.message}`);
        break; // FK order matters — do not push child tables past a failed parent
      }
      await table(name).bulkPut(rows.map((r) => ({ ...r, sync_status: 'synced' as const })));
    }

    if (!hadError) {
      const queue =
        ((await db.meta.get('delete_queue'))?.value as QueuedDelete[] | undefined) ?? [];
      const remaining: QueuedDelete[] = [];
      for (const d of queue) {
        const { error } = await supabase.from(d.table).delete().eq('id', d.id);
        if (error) {
          console.warn(`[sync] delete failed for ${d.table}/${d.id}: ${error.message}`);
          remaining.push(d);
          hadError = true;
        }
      }
      await db.meta.put({ key: 'delete_queue', value: remaining });
    }
  } finally {
    pushing = false;
  }

  if (hadError) {
    backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
    schedulePush(backoffMs);
  } else {
    backoffMs = 2000;
  }
}

/** Merge all server rows for this user into Dexie. Local pending rows win. */
export async function pullAll(userId: string): Promise<void> {
  if (!syncEnabled) return;
  lastPullAt = Date.now();
  for (const name of SYNCED_TABLES) {
    const { data, error } = await supabase.from(name).select('*').eq('user_id', userId);
    if (error) {
      console.warn(`[sync] pull failed for ${name}: ${error.message}`);
      continue;
    }
    if (!data?.length) continue;
    await db.transaction('rw', table(name), async () => {
      for (const remote of data as { id: string }[]) {
        const local = await table(name).get(remote.id);
        if (local && local.sync_status !== 'synced') {
          console.info(`[sync] conflict on ${name}/${remote.id}: local pending wins`);
          continue;
        }
        await table(name).put({ ...remote, sync_status: 'synced' });
      }
    });
  }
}

function onOnline() {
  schedulePush(0);
  if (currentUserId && Date.now() - lastPullAt > PULL_MIN_GAP_MS) void pullAll(currentUserId);
}

function onFocus() {
  if (currentUserId && Date.now() - lastPullAt > PULL_MIN_GAP_MS) void pullAll(currentUserId);
  schedulePush(0);
}

/** Start the engine for a signed-in (non-sandbox) user. Idempotent. */
export function initSync(userId: string): void {
  if (!supabaseConfigured) return;
  syncEnabled = true;
  currentUserId = userId;
  if (!started) {
    started = true;
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
  }
  void pullAll(userId);
  schedulePush(0);
}

export function stopSync(): void {
  syncEnabled = false;
  currentUserId = null;
  clearTimeout(pushTimer);
}

/** Test hook: force-enable without listeners (unit tests drive pushes manually). */
export function _enableForTests(userId: string): void {
  syncEnabled = true;
  currentUserId = userId;
  backoffMs = 2000;
}
