// /buddy — landing page. The full buddy loop (F6.1–F6.6: invites, weekly
// shared insight, send-a-doubt, async study room, sadhana peer, compare
// weak spots) is intentionally deferred (DECISIONS.md 2026-07-18). This page
// is the honest current state: shows any live pairing, points at Settings
// for the invite flow, and lists what each feature will do so the user isn't
// left staring at a stub.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Columns3, MessageSquareText, RefreshCcw, Send, Sparkles, Users } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils';
import type { BuddyRow, UserRow } from '@/types';

interface BuddyView {
  row: BuddyRow;
  peer: Pick<UserRow, 'id' | 'name' | 'email'> | null;
}

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'Weekly shared insight',
    body: 'Your one-liner conclusion from Weekly review, mirrored to a paired buddy. Read the peer’s answer without comparing scores.'
  },
  {
    icon: Send,
    title: 'Send-a-doubt',
    body: 'Push any journal entry into a peer inbox. They mark it solved when they help — no chat, just close-the-loop.'
  },
  {
    icon: Columns3,
    title: 'Compare weak spots',
    body: 'Side-by-side heatmap. Highlights cells where the peer is strong and you are not — a specific ask for a specific gap.'
  },
  {
    icon: Users,
    title: 'Async study room',
    body: 'Both join at a set time, presence only. No video, no text — the "sitting-in-the-library" signal.'
  },
  {
    icon: Sparkles,
    title: 'Weekly synthesis exchange',
    body: 'The LLM second-opinion from Weekly review is optionally shared. Different upstream nodes from two vantage points.'
  }
] as const;

export default function Buddy() {
  const { userId, sandbox } = useAuth();
  const [buddies, setBuddies] = useState<BuddyView[]>([]);
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
      setLoading(false);
      return;
    }
    const { data: peers } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', peerIds);
    const peerMap = new Map(((peers as Pick<UserRow, 'id' | 'name' | 'email'>[]) ?? []).map((p) => [p.id, p]));
    setBuddies(
      rows.map((r) => ({
        row: r,
        peer: peerMap.get(r.user_a === userId ? r.user_b : r.user_a) ?? null
      }))
    );
    setLoading(false);
  }

  const showLocalMsg = sandbox || !supabaseConfigured;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Buddy"
        description="One peer. Enough shared signal to keep each other honest — none of the shame surface of a leaderboard."
      />

      {showLocalMsg ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-text-muted">
              Sandbox / local-only mode. Pair-up features rely on Supabase auth and RLS. Sign in
              with a real account to invite a buddy.
            </p>
            <Link to="/settings">
              <Button variant="ghost" size="sm">
                Open Settings
              </Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Pairing"
            aside={
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
                  <RefreshCcw size={12} strokeWidth={1.75} className="mr-1" />
                  Refresh
                </Button>
                <Link to="/settings">
                  <Button variant="primary" size="sm">
                    Invite via Settings
                  </Button>
                </Link>
              </div>
            }
          />
          {error && (
            <div className="border-b border-border/60 px-4 py-2 text-[12px] text-warn">{error}</div>
          )}
          {loading ? (
            <div className="px-4 py-4 text-[12px] text-text-faint">Loading…</div>
          ) : buddies.length === 0 ? (
            <Empty
              title="No pairing yet"
              hint="Head to Settings → Invites, generate a token, and share the link. First person to redeem becomes your buddy."
              className="border-0 py-8"
            />
          ) : (
            <ul className="divide-y divide-border">
              {buddies.map(({ row, peer }) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[13px]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-cobalt/15 font-display text-[13px] font-bold text-ink-cobalt">
                    {(peer?.name ?? '?')[0].toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-text">{peer?.name ?? 'Unknown peer'}</p>
                    <p className="u-num truncate text-[11px] text-text-faint">
                      {peer?.email ?? '—'}
                    </p>
                  </div>
                  <Badge tone={row.status === 'active' ? 'success' : row.status === 'pending' ? 'warn' : 'neutral'}>
                    {row.status}
                  </Badge>
                  <span className="text-[11px] text-text-faint">
                    since {formatDate(row.created_at.slice(0, 10), 'dd MMM yyyy')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <CardHeader title="What arrives when both of you are in" />
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="flex flex-col gap-2 rounded border border-border/70 bg-bg-overlay/30 px-3 py-3"
              >
                <span className="flex items-center gap-2 font-display text-[13px] font-semibold text-text">
                  <Icon size={14} strokeWidth={1.75} className="text-accent" />
                  {f.title}
                </span>
                <p className="text-[12.5px] leading-relaxed text-text-muted">{f.body}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded border border-border/70 bg-bg-overlay/30 px-3 py-2 text-[12px] text-text-muted">
        <MessageSquareText size={12} strokeWidth={1.75} className="mt-0.5 text-text-faint" />
        <p>
          Buddy features layer on top of your solo loop — they never replace it. If the peer is
          silent for a week, nothing on your side changes; nothing pings, nothing shames.
        </p>
      </div>
    </div>
  );
}
