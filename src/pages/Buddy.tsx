// /buddy — send/accept requests + 1:1 chat with active buddies.
// Security notes:
//   - Discovery is by exact username. The edge fn never reveals whether the
//     username exists (anti-enumeration).
//   - Chat is gated on buddies.status='active' at RLS. Pending/declined pairs
//     cannot exchange messages.
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Check, RefreshCcw, Search, X } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Empty } from '@/components/ui/Empty';
import BuddyChat from '@/components/buddy/BuddyChat';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { sendBuddyRequest } from '@/lib/edge';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/stores/ui';
import type { BuddyRow, UserRow } from '@/types';
import { formatDate } from '@/lib/utils';

interface BuddyView {
  row: BuddyRow & {
    requested_by: string | null;
    responded_at: string | null;
    decline_reason: string | null;
  };
  peer: Pick<UserRow, 'id' | 'name' | 'email' | 'username'> | null;
}

const USERNAME_RE = /^[a-z0-9_]{3,32}$/;

export default function Buddy() {
  const { userId, sandbox } = useAuth();
  const [buddies, setBuddies] = useState<BuddyView[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uname, setUname] = useState('');
  const [sending, setSending] = useState(false);
  const pushToast = useUiStore((s) => s.pushToast);

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
    const rows = (data as BuddyView['row'][]) ?? [];
    const peerIds = rows.map((r) => (r.user_a === userId ? r.user_b : r.user_a));
    let peerMap = new Map<string, Pick<UserRow, 'id' | 'name' | 'email' | 'username'>>();
    if (peerIds.length > 0) {
      const { data: peers } = await supabase
        .from('users')
        .select('id, name, email, username')
        .in('id', peerIds);
      peerMap = new Map(
        ((peers as Pick<UserRow, 'id' | 'name' | 'email' | 'username'>[]) ?? []).map((p) => [p.id, p])
      );
    }
    const list: BuddyView[] = rows.map((r) => ({
      row: r,
      peer: peerMap.get(r.user_a === userId ? r.user_b : r.user_a) ?? null
    }));
    setBuddies(list);
    setActiveId((prev) => {
      const activeList = list.filter((v) => v.row.status === 'active');
      return prev && activeList.some((v) => v.row.id === prev)
        ? prev
        : activeList[0]?.row.id ?? null;
    });
    setLoading(false);
  }

  async function onSendRequest(e: FormEvent) {
    e.preventDefault();
    const cleaned = uname.trim().toLowerCase();
    if (!USERNAME_RE.test(cleaned)) {
      pushToast('Enter a valid username (3–32 lowercase letters/digits/_).', 'neutral');
      return;
    }
    if (cleaned === '') return;
    setSending(true);
    const res = await sendBuddyRequest(cleaned);
    setSending(false);
    if ('ok' in res && res.ok) {
      pushToast(
        `If @${cleaned} exists, they'll see your request on their Buddy page.`,
        'success'
      );
      setUname('');
      void reload();
    } else {
      pushToast(res.error, 'neutral');
    }
  }

  async function onRespond(bId: string, action: 'accept' | 'decline') {
    const reason = action === 'decline' ? window.prompt('Optional reason (or leave blank):') ?? '' : '';
    const { error } = await supabase.rpc('respond_buddy_request', {
      b_id: bId,
      action,
      reason: reason || null
    });
    if (error) {
      pushToast(error.message, 'neutral');
      return;
    }
    pushToast(action === 'accept' ? 'Buddy pair active. Say hi.' : 'Request declined.', 'success');
    void reload();
  }

  const showLocalMsg = sandbox || !supabaseConfigured;
  const incoming = useMemo(
    () =>
      buddies.filter(
        (b) =>
          b.row.status === 'pending' && b.row.requested_by !== userId && b.peer !== null
      ),
    [buddies, userId]
  );
  const outgoing = useMemo(
    () =>
      buddies.filter(
        (b) =>
          b.row.status === 'pending' && b.row.requested_by === userId && b.peer !== null
      ),
    [buddies, userId]
  );
  const activePairs = useMemo(() => buddies.filter((b) => b.row.status === 'active'), [buddies]);
  const paused = useMemo(() => buddies.filter((b) => b.row.status === 'paused'), [buddies]);
  const active = activePairs.find((b) => b.row.id === activeId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Buddy"
        description="One peer at a time. Send a request by username. Chat opens when the other side accepts."
      />

      {showLocalMsg ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-text-muted">
              Sandbox / local-only mode. Buddy features rely on Supabase auth.
            </p>
            <Link to="/settings">
              <Button variant="ghost" size="sm">
                Open Settings
              </Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <>
          {/* Incoming requests are the most urgent — show first if any */}
          <AnimatePresence>
            {incoming.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <Card>
                  <CardHeader
                    title={`Incoming requests · ${incoming.length}`}
                    aside={
                      <Button variant="ghost" size="sm" onClick={() => void reload()}>
                        <RefreshCcw size={11} strokeWidth={1.75} className="mr-1" />
                        Refresh
                      </Button>
                    }
                  />
                  <ul className="divide-y divide-border">
                    {incoming.map((b) => (
                      <li key={b.row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <PeerAvatar name={b.peer?.name ?? '?'} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-text">
                            {b.peer?.name}
                          </p>
                          <p className="u-num truncate text-[11.5px] text-text-faint">
                            @{b.peer?.username}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => void onRespond(b.row.id, 'accept')}
                          >
                            <Check size={12} strokeWidth={2} className="mr-1" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void onRespond(b.row.id, 'decline')}
                          >
                            <X size={12} strokeWidth={2} className="mr-1" />
                            Decline
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Send a new request */}
          <Card>
            <CardHeader title="Find a buddy" />
            <CardBody>
              <form onSubmit={onSendRequest} className="flex flex-wrap items-end gap-3">
                <div className="min-w-[240px] flex-1">
                  <label htmlFor="b-uname" className="u-label mb-1 block">
                    Their username
                  </label>
                  <Input
                    id="b-uname"
                    placeholder="rank_notebook"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={32}
                    value={uname}
                    onChange={(e) =>
                      setUname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    disabled={sending}
                  />
                  <p className="mt-1 text-[11px] text-text-faint">
                    Exact match only. You'll always see the same "sent" message — the app
                    never reveals whether a username exists.
                  </p>
                </div>
                <Button type="submit" variant="primary" disabled={sending || uname.length < 3}>
                  <Search size={12} strokeWidth={2} className="mr-1" />
                  {sending ? 'Sending…' : 'Send request'}
                </Button>
              </form>
            </CardBody>
          </Card>

          {/* Outgoing pendings + paused/declined visible for transparency */}
          {(outgoing.length > 0 || paused.length > 0) && (
            <Card>
              <CardHeader title="Waiting / paused" />
              <ul className="divide-y divide-border">
                {outgoing.map((b) => (
                  <li key={b.row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <PeerAvatar name={b.peer?.name ?? '?'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-text">
                        {b.peer?.name}
                      </p>
                      <p className="u-num truncate text-[11.5px] text-text-faint">
                        @{b.peer?.username} · sent {formatDate(b.row.created_at.slice(0, 10), 'dd MMM')}
                      </p>
                    </div>
                    <span className="rounded-full border border-warn/40 bg-warn/5 px-2 py-0.5 text-[11px] font-medium text-warn">
                      pending
                    </span>
                  </li>
                ))}
                {paused.map((b) => (
                  <li key={b.row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <PeerAvatar name={b.peer?.name ?? '?'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-text">
                        {b.peer?.name}
                      </p>
                      <p className="u-num truncate text-[11.5px] text-text-faint">
                        @{b.peer?.username}
                        {b.row.decline_reason ? ` · ${b.row.decline_reason}` : ''}
                      </p>
                    </div>
                    <span className="rounded-full border border-border bg-bg-overlay px-2 py-0.5 text-[11px] text-text-muted">
                      paused
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Chat with active buddies */}
          {activePairs.length === 0 ? (
            loading ? null : (
              <Card>
                <Empty
                  title="No active buddy yet"
                  hint="Send a request by username or accept one from an incoming request. Chat unlocks the moment both sides are in."
                  className="border-0 py-8"
                />
              </Card>
            )
          ) : (
            <>
              {activePairs.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  {activePairs.map((b) => (
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

function PeerAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-cobalt/15 font-display text-[13px] font-bold text-ink-cobalt">
      {(name ?? '?')[0].toUpperCase()}
    </span>
  );
}
