// /buddy — DM-style buddy page.
//
// Two-column layout on desktop:
//   Left  : buddy list (Insta DM style) + find/incoming panel above it
//   Right : chat with the selected buddy (or "Start a chat" empty state)
// On mobile: same panels stack, tapping a buddy pushes the chat in place.
//
// Security notes stay:
//   - Discovery is by exact username (edge fn returns 'no_such_user' when
//     unknown so the requester gets clear feedback).
//   - RLS on buddy_messages requires status='active' — pending/paused pairs
//     never see chat.
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Check,
  MessageSquarePlus,
  RefreshCcw,
  Search,
  UserPlus,
  X
} from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import BuddyChat from '@/components/buddy/BuddyChat';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { sendBuddyRequest } from '@/lib/edge';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/stores/ui';
import type { BuddyMessageRow, BuddyRow, UserRow } from '@/types';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface BuddyRowExt extends BuddyRow {
  requested_by: string | null;
  responded_at: string | null;
  decline_reason: string | null;
}

interface BuddyView {
  row: BuddyRowExt;
  peer: Pick<UserRow, 'id' | 'name' | 'email' | 'username'> | null;
  last?: BuddyMessageRow | null;
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
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const pushToast = useUiStore((s) => s.pushToast);
  const initialSelect = useRef(true);

  const reload = useCallback(async () => {
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
    const rows = (data as BuddyRowExt[]) ?? [];
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

    // Fetch last-message preview per active pair (small parallel calls)
    const activeRows = list.filter((v) => v.row.status === 'active').slice(0, 30);
    await Promise.all(
      activeRows.map(async (v) => {
        const { data: msg } = await supabase
          .from('buddy_messages')
          .select('id, buddy_id, sender_id, kind, body, question_ref, created_at, read_at')
          .eq('buddy_id', v.row.id)
          .order('created_at', { ascending: false })
          .limit(1);
        v.last = ((msg as BuddyMessageRow[]) ?? [])[0] ?? null;
      })
    );

    setBuddies(list);
    if (initialSelect.current) {
      const first = list.find((v) => v.row.status === 'active');
      if (first) setActiveId(first.row.id);
      initialSelect.current = false;
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId || sandbox || !supabaseConfigured) {
      setBuddies([]);
      return;
    }
    void reload();
  }, [userId, sandbox, reload]);

  async function onSendRequest(e: FormEvent) {
    e.preventDefault();
    const cleaned = uname.trim().toLowerCase().replace(/^@+/, '');
    if (!USERNAME_RE.test(cleaned)) {
      pushToast('Enter a valid username (3–32 lowercase letters/digits/_).', 'neutral');
      return;
    }
    setSending(true);
    const res = await sendBuddyRequest(cleaned);
    setSending(false);
    if (!('ok' in res && res.ok)) {
      pushToast(res.error, 'neutral');
      return;
    }
    switch (res.status) {
      case 'no_such_user':
        pushToast(`No user with username @${cleaned}. Check the spelling.`, 'neutral');
        return;
      case 'invalid_username':
        pushToast('Usernames are 3–32 characters, lowercase letters/digits/underscore.', 'neutral');
        return;
      case 'self':
        pushToast("That's you.", 'neutral');
        return;
      case 'rate_limit':
        pushToast('You have hit the daily request limit. Try again tomorrow.', 'neutral');
        return;
      case 'cooldown':
        pushToast(`@${cleaned} recently declined. Re-request after 24 hours.`, 'neutral');
        return;
      case 'already_pending':
        pushToast(`You already have a pending request to @${cleaned}.`, 'neutral');
        break;
      case 'active':
        pushToast(`@${cleaned} is already your active buddy.`, 'neutral');
        break;
      default:
        pushToast(`Request sent to @${cleaned}.`, 'success');
        break;
    }
    setUname('');
    setShowAddPanel(false);
    void reload();
  }

  async function onRespond(bId: string, action: 'accept' | 'decline') {
    const reason =
      action === 'decline' ? window.prompt('Optional reason (or leave blank):') ?? '' : '';
    const { error } = await supabase.rpc('respond_buddy_request', {
      b_id: bId,
      action,
      reason: reason || null
    });
    if (error) {
      pushToast(error.message, 'neutral');
      return;
    }
    pushToast(action === 'accept' ? 'Pair active. Say hi.' : 'Request declined.', 'success');
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
  const paused = useMemo(() => buddies.filter((b) => b.row.status === 'paused'), [buddies]);
  const active = useMemo(
    () =>
      buddies
        .filter((b) => b.row.status === 'active')
        .sort((a, b) => {
          const ta = a.last?.created_at ?? a.row.created_at;
          const tb = b.last?.created_at ?? b.row.created_at;
          return tb.localeCompare(ta);
        }),
    [buddies]
  );
  const activeBuddy = active.find((b) => b.row.id === activeId) ?? null;

  if (showLocalMsg) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Buddy" description="One peer at a time." />
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
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-[22px] font-bold leading-tight text-text">
            Buddy
          </h1>
          <p className="text-[12.5px] text-text-muted">
            Chats stay between you and one peer. Sharing a question hides your tags.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {incoming.length > 0 && (
            <span className="rounded-full border border-warn/40 bg-warn/5 px-2 py-0.5 text-[11px] font-medium text-warn">
              {incoming.length} request{incoming.length === 1 ? '' : 's'}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
            <RefreshCcw size={11} strokeWidth={1.75} className="mr-1" />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddPanel((v) => !v)}
          >
            <UserPlus size={11} strokeWidth={2} className="mr-1" />
            New buddy
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showAddPanel && (
          <motion.div
            initial={{ opacity: 0, y: -6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardBody>
                <form onSubmit={onSendRequest} className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[240px] flex-1">
                    <label htmlFor="b-uname" className="u-label mb-1 block">
                      Their username
                    </label>
                    <div className="flex h-10 items-stretch overflow-hidden rounded border border-border bg-bg-raised transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_3px_theme(colors.accent.faint)]">
                      <span className="flex select-none items-center border-r border-border bg-bg-overlay/60 px-3 font-display text-[14px] font-semibold text-text-muted">
                        @
                      </span>
                      <input
                        id="b-uname"
                        type="text"
                        placeholder="rank_notebook"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={32}
                        value={uname}
                        onChange={(e) =>
                          setUname(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                        }
                        disabled={sending}
                        className="block flex-1 bg-transparent px-3 text-[13.5px] text-text placeholder:text-text-faint focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                        autoFocus
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-text-faint">
                      Exact match — case-insensitive. They'll see your request in Buddy.
                    </p>
                  </div>
                  <Button type="submit" variant="primary" disabled={sending || uname.length < 3}>
                    <Search size={12} strokeWidth={2} className="mr-1" />
                    {sending ? 'Sending…' : 'Send'}
                  </Button>
                </form>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {incoming.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <div className="border-b border-border px-4 py-2">
                <p className="u-label">Incoming · {incoming.length}</p>
              </div>
              <ul className="divide-y divide-border">
                {incoming.map((b) => (
                  <li key={b.row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <Avatar name={b.peer?.name ?? '?'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-text">
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
                        <Check size={11} strokeWidth={2} className="mr-1" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void onRespond(b.row.id, 'decline')}
                      >
                        <X size={11} strokeWidth={2} className="mr-1" /> Decline
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)]">
        {/* Buddies list */}
        <div
          className={cn(
            'flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-bg-raised',
            mobileView === 'chat' ? 'hidden md:flex' : 'flex'
          )}
        >
          <div className="border-b border-border px-3 py-2">
            <p className="u-label">Buddies · {active.length}</p>
          </div>
          {loading && active.length === 0 ? (
            <p className="px-4 py-4 text-[12px] text-text-faint">Loading…</p>
          ) : active.length === 0 ? (
            <div className="flex flex-col items-start gap-3 p-4">
              <p className="text-[12.5px] text-text-muted">
                No active buddies yet. Send a request or accept an incoming one to start
                chatting.
              </p>
              <Button size="sm" variant="primary" onClick={() => setShowAddPanel(true)}>
                <MessageSquarePlus size={11} strokeWidth={2} className="mr-1" />
                New buddy
              </Button>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {active.map((b) => (
                <li key={b.row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveId(b.row.id);
                      setMobileView('chat');
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                      activeId === b.row.id
                        ? 'bg-accent-faint/40'
                        : 'hover:bg-bg-overlay/60'
                    )}
                  >
                    <Avatar name={b.peer?.name ?? '?'} active={activeId === b.row.id} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-[13.5px] font-semibold text-text">
                          {b.peer?.name}
                        </p>
                        {b.last && (
                          <span className="u-num shrink-0 text-[10.5px] text-text-faint">
                            {shortTime(b.last.created_at)}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11.5px] text-text-faint">
                        {b.last
                          ? previewOf(b.last, b.last.sender_id === userId)
                          : `@${b.peer?.username} · say hi`}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {(outgoing.length > 0 || paused.length > 0) && (
            <details className="border-t border-border/70 bg-bg-overlay/30 px-3 py-2 text-[11.5px] text-text-muted">
              <summary className="cursor-pointer">
                {outgoing.length + paused.length} not-yet-chatting
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {outgoing.map((b) => (
                  <li key={b.row.id} className="flex items-center gap-2">
                    <span className="u-num truncate">@{b.peer?.username}</span>
                    <span className="ml-auto rounded-full border border-warn/40 bg-warn/5 px-1.5 py-0.5 text-[10px] text-warn">
                      pending
                    </span>
                  </li>
                ))}
                {paused.map((b) => (
                  <li key={b.row.id} className="flex items-center gap-2">
                    <span className="u-num truncate">@{b.peer?.username}</span>
                    <span className="ml-auto rounded-full border border-border bg-bg-overlay px-1.5 py-0.5 text-[10px] text-text-muted">
                      paused
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* Chat pane */}
        <div
          className={cn(
            'min-h-0 overflow-hidden',
            mobileView === 'list' ? 'hidden md:block' : 'block'
          )}
        >
          {activeBuddy && activeBuddy.peer && userId ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-2 flex items-center gap-2 md:hidden">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="inline-flex items-center gap-1 rounded border border-border bg-bg-raised px-2 py-1 text-[12px] text-text-muted"
                >
                  <ArrowLeft size={12} strokeWidth={1.75} /> Back
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <BuddyChat
                  buddyId={activeBuddy.row.id}
                  meId={userId}
                  peer={activeBuddy.peer}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-bg-overlay/40 p-6 text-center">
              <MessageSquarePlus size={28} strokeWidth={1.5} className="text-text-faint" />
              <p className="font-display text-[15px] font-semibold text-text">Start a chat</p>
              <p className="max-w-[320px] text-[12.5px] leading-relaxed text-text-muted">
                Pick a buddy from the list, or add one with the{' '}
                <span className="u-num text-text">New buddy</span> button. Your first message
                opens the room.
              </p>
              {active.length === 0 && (
                <Button size="sm" variant="primary" onClick={() => setShowAddPanel(true)}>
                  <UserPlus size={11} strokeWidth={2} className="mr-1" />
                  New buddy
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded border border-warn/40 bg-warn/5 px-3 py-2 text-[12px] text-warn">
          {error}
        </div>
      )}
    </div>
  );
}

function Avatar({ name, active = false }: { name: string; active?: boolean }) {
  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-[14px] font-bold',
        active
          ? 'bg-accent text-white'
          : 'bg-ink-cobalt/15 text-ink-cobalt'
      )}
    >
      {(name ?? '?')[0].toUpperCase()}
    </span>
  );
}

function shortTime(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const sameDay =
    then.toDateString() === now.toDateString();
  if (sameDay) {
    return then.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((+now - +then) / 86400000);
  if (diffDays < 7) {
    return then.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return formatDate(iso.slice(0, 10), 'dd MMM');
}

function previewOf(m: BuddyMessageRow, isMine: boolean): string {
  const prefix = isMine ? 'You: ' : '';
  if (m.kind === 'question') {
    const subj = m.question_ref?.subject ?? 'question';
    return `${prefix}[shared ${subj} question]`;
  }
  return `${prefix}${(m.body ?? '').replace(/\s+/g, ' ').slice(0, 60)}`;
}
