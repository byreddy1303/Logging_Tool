// /buddy — production chat between paired buddies.
// No reviews, no performance leaks — just conversation and shared questions.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import BuddyChat from '@/components/buddy/BuddyChat';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { BuddyRow, UserRow } from '@/types';

interface BuddyView {
  row: BuddyRow;
  peer: Pick<UserRow, 'id' | 'name' | 'email'> | null;
}

export default function Buddy() {
  const { userId, sandbox } = useAuth();
  const [buddies, setBuddies] = useState<BuddyView[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || sandbox || !supabaseConfigured) {
      setBuddies([]);
      return;
    }
    void reload();
  }, [userId, sandbox]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reload() {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('buddies')
      .select('*')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const rows = (data as BuddyRow[]) ?? [];
    const peerIds = rows.map((r) => (r.user_a === userId ? r.user_b : r.user_a));
    if (peerIds.length === 0) {
      setBuddies([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    const { data: peers } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', peerIds);
    const peerMap = new Map(
      ((peers as Pick<UserRow, 'id' | 'name' | 'email'>[]) ?? []).map((p) => [p.id, p])
    );
    const list: BuddyView[] = rows
      .map((r) => ({
        row: r,
        peer: peerMap.get(r.user_a === userId ? r.user_b : r.user_a) ?? null
      }))
      .filter((v) => v.row.status === 'active' && v.peer !== null);
    setBuddies(list);
    setActiveId((prev) => prev && list.some((v) => v.row.id === prev) ? prev : list[0]?.row.id ?? null);
    setLoading(false);
  }

  const showLocalMsg = sandbox || !supabaseConfigured;
  const active = buddies.find((b) => b.row.id === activeId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Buddy"
        description="One peer. A calm chat + a way to hand each other a hard question without leaking any of your own analysis."
      />

      {showLocalMsg ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-text-muted">
              Sandbox / local-only mode. Chat and pairing rely on Supabase auth. Sign in with a
              real account to use the buddy loop.
            </p>
            <Link to="/settings">
              <Button variant="ghost" size="sm">
                Open Settings
              </Button>
            </Link>
          </CardBody>
        </Card>
      ) : loading && buddies.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-[12px] text-text-faint">Loading…</p>
          </CardBody>
        </Card>
      ) : buddies.length === 0 ? (
        <Card>
          <CardHeader
            title="No pairing yet"
            aside={
              <Link to="/settings">
                <Button variant="primary" size="sm">
                  Invite via Settings
                </Button>
              </Link>
            }
          />
          <Empty
            title="Pair up first"
            hint="Head to Settings → Access requests, approve someone, and they become your buddy automatically once they redeem the invite. Chat opens up as soon as pairing goes active."
            className="border-0 py-8"
          />
        </Card>
      ) : (
        <>
          {buddies.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {buddies.map((b) => (
                <button
                  key={b.row.id}
                  type="button"
                  onClick={() => setActiveId(b.row.id)}
                  className={
                    activeId === b.row.id
                      ? 'inline-flex items-center gap-2 rounded-full border border-transparent bg-accent-faint px-3 py-1 text-[12px] font-semibold text-accent'
                      : 'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[12px] text-text-muted hover:border-border-hover hover:text-text'
                  }
                >
                  {b.peer?.name ?? 'peer'}
                </button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => void reload()}>
                <RefreshCcw size={11} strokeWidth={1.75} className="mr-1" />
                Refresh
              </Button>
            </div>
          )}
          {active && active.peer && userId && (
            <BuddyChat buddyId={active.row.id} meId={userId} peer={active.peer} />
          )}
        </>
      )}

      {error && (
        <div className="rounded border border-warn/40 bg-warn/5 px-3 py-2 text-[12px] text-warn">
          {error}
        </div>
      )}
    </div>
  );
}
