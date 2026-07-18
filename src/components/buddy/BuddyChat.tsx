// 1:1 chat between paired buddies. Real-time via Supabase postgres_changes.
//
// Message kinds:
//   text     — plain text bubble
//   question — shared-question card. The payload deliberately excludes the
//              sender's outcome, pattern, root cause, notes and any analysis.
//              Only the raw question (source, format, prompt, image, target
//              time). The recipient sees the question fresh, no bias.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'motion/react';
import { Image as ImageIcon, Send, ArrowUp, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/db';
import type {
  BuddyMessageRow,
  QuestionRow,
  SharedQuestionRef,
  UserRow
} from '@/types';
import { formatDate } from '@/lib/utils';
import { subjectInk } from '@/lib/subjectInk';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Props {
  buddyId: string;
  meId: string;
  peer: Pick<UserRow, 'id' | 'name' | 'email'>;
}

const TEXT_LIMIT = 4000;
const MSG_PAGE_SIZE = 200;

/** Strip a QuestionRow down to what's safe to send to a buddy. */
function safeQuestionRef(q: QuestionRow): SharedQuestionRef {
  return {
    subject: q.subject,
    subtopic: q.subtopic,
    question_text: q.question_text,
    image_url: q.image_url,
    source_ref: q.source_ref,
    source_year: q.source_year,
    target_time_sec: q.target_time_sec,
    origin_question_id: q.id
  };
}

export default function BuddyChat({ buddyId, meId, peer }: Props) {
  const [messages, setMessages] = useState<BuddyMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const initialLoad = useRef(true);

  // Initial fetch + realtime subscribe.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('buddy_messages')
        .select('*')
        .eq('buddy_id', buddyId)
        .order('created_at', { ascending: true })
        .limit(MSG_PAGE_SIZE);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setError(null);
      setMessages((data as BuddyMessageRow[]) ?? []);
      setLoading(false);
    }
    void load();

    const channel: RealtimeChannel = supabase
      .channel(`buddy_messages:${buddyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'buddy_messages',
          filter: `buddy_id=eq.${buddyId}`
        },
        (payload) => {
          const row = payload.new as BuddyMessageRow;
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [buddyId]);

  // Auto-scroll to bottom on new messages / initial load.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    // On first load, jump. After that, only scroll if we were already near
    // the bottom (so the user isn't yanked away while reading history).
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (initialLoad.current || nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
    if (!loading && messages.length > 0) initialLoad.current = false;
  }, [messages, loading]);

  async function sendText() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    // Optimistic append.
    const optimistic: BuddyMessageRow = {
      id: crypto.randomUUID(),
      buddy_id: buddyId,
      sender_id: meId,
      kind: 'text',
      body,
      question_ref: null,
      created_at: new Date().toISOString(),
      read_at: null
    };
    setMessages((m) => [...m, optimistic]);
    setDraft('');
    const { error } = await supabase.from('buddy_messages').insert({
      id: optimistic.id,
      buddy_id: buddyId,
      sender_id: meId,
      kind: 'text',
      body
    });
    setSending(false);
    if (error) {
      // Roll back the optimistic message and re-populate the draft so the
      // user can retry.
      setMessages((m) => m.filter((row) => row.id !== optimistic.id));
      setDraft(body);
      setError(error.message);
    } else {
      setError(null);
    }
  }

  async function shareQuestion(q: QuestionRow) {
    setPicker(false);
    setSending(true);
    const ref = safeQuestionRef(q);
    const optimistic: BuddyMessageRow = {
      id: crypto.randomUUID(),
      buddy_id: buddyId,
      sender_id: meId,
      kind: 'question',
      body: null,
      question_ref: ref,
      created_at: new Date().toISOString(),
      read_at: null
    };
    setMessages((m) => [...m, optimistic]);
    const { error } = await supabase.from('buddy_messages').insert({
      id: optimistic.id,
      buddy_id: buddyId,
      sender_id: meId,
      kind: 'question',
      question_ref: ref
    });
    setSending(false);
    if (error) {
      setMessages((m) => m.filter((row) => row.id !== optimistic.id));
      setError(error.message);
    }
  }

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  return (
    <div className="flex h-[540px] max-h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-lg border border-border bg-bg-raised">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-cobalt/15 font-display text-[13px] font-bold text-ink-cobalt">
          {(peer.name ?? '?')[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-text">{peer.name}</p>
          <p className="u-num truncate text-[11px] text-text-faint">{peer.email}</p>
        </div>
      </header>

      {error && (
        <div className="border-b border-border/60 px-4 py-2 text-[12px] text-warn">{error}</div>
      )}

      <div
        ref={listRef}
        className="relative flex-1 overflow-y-auto bg-bg px-3 py-4 sm:px-4"
      >
        {loading ? (
          <p className="mt-6 text-center text-[12px] text-text-faint">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-2 text-center">
            <p className="font-display text-[15px] font-semibold text-text">
              Start the conversation.
            </p>
            <p className="max-w-[280px] text-[12.5px] leading-relaxed text-text-muted">
              Ask a doubt. Share a question you're stuck on. Nothing about your
              tags or performance ever crosses over — only the question itself.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {grouped.map((chunk) => (
              <li key={chunk.day} className="flex flex-col gap-2">
                <div className="mx-auto rounded-full border border-border bg-bg-raised px-3 py-0.5 text-[10.5px] uppercase tracking-wider text-text-faint">
                  {formatDate(chunk.day, 'EEE, dd MMM')}
                </div>
                {chunk.rows.map((m) => (
                  <MessageBubble
                    key={m.id}
                    msg={m}
                    isMe={m.sender_id === meId}
                  />
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border px-3 py-3">
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-bg-raised text-text-muted transition-all hover:-translate-y-px hover:border-border-hover hover:text-text hover:shadow-card active:translate-y-0"
            title="Share a question"
          >
            <ImageIcon size={16} strokeWidth={1.75} />
          </button>
          <div className="flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, TEXT_LIMIT))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendText();
                }
              }}
              placeholder={`Message ${peer.name.split(' ')[0] || peer.name}…`}
              rows={1}
              className="block max-h-32 min-h-[40px] w-full resize-none rounded border border-border bg-bg-raised px-3 py-2 text-[13.5px] leading-snug text-text placeholder:text-text-faint focus:border-accent focus:shadow-[0_0_0_3px_theme(colors.accent.faint)] focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between text-[10.5px] text-text-faint">
              <span>Enter to send · Shift+Enter for newline</span>
              <span className="u-num">
                {draft.length}/{TEXT_LIMIT}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={() => void sendText()}
            disabled={sending || draft.trim().length === 0}
            className="h-10 w-10 shrink-0 !p-0"
            title="Send"
          >
            <Send size={16} strokeWidth={2} />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {picker && (
          <QuestionPicker
            meId={meId}
            onPick={(q) => void shareQuestion(q)}
            onClose={() => setPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({ msg, isMe }: { msg: BuddyMessageRow; isMe: boolean }) {
  const time = new Date(msg.created_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn('flex', isMe ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('max-w-[80%]', isMe ? 'items-end' : 'items-start')}>
        {msg.kind === 'question' ? (
          <QuestionCard ref_={msg.question_ref!} isMe={isMe} />
        ) : (
          <div
            className={cn(
              'rounded-2xl px-3 py-2 text-[13.5px] leading-relaxed shadow-sm',
              isMe
                ? 'bg-accent text-white rounded-br-md'
                : 'bg-bg-raised text-text border border-border rounded-bl-md'
            )}
          >
            <p className="whitespace-pre-wrap break-words">{msg.body}</p>
          </div>
        )}
        <p
          className={cn(
            'mt-1 px-1 text-[10.5px] tabular-nums text-text-faint',
            isMe ? 'text-right' : 'text-left'
          )}
        >
          {time}
        </p>
      </div>
    </motion.div>
  );
}

function QuestionCard({ ref_, isMe }: { ref_: SharedQuestionRef; isMe: boolean }) {
  const ink = subjectInk(ref_.subject);
  const sourceLine = ref_.source_ref
    ? `${ref_.source_ref}${ref_.source_year ? ` · ${ref_.source_year}` : ''}`
    : ref_.source_year
      ? `${ref_.source_year}`
      : null;
  const targetMin = Math.round(ref_.target_time_sec / 60);
  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-2xl border shadow-sm',
        isMe ? 'bg-white/95 border-white/50 rounded-br-md' : 'bg-bg-raised border-border rounded-bl-md'
      )}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted">
          <span className={cn('h-1.5 w-1.5 rounded-full', ink.dot)} />
          {ref_.subject}
          {ref_.subtopic ? <span className="text-text-faint"> · {ref_.subtopic}</span> : null}
        </span>
        <span className="u-num text-[10.5px] text-text-faint">
          {targetMin}m target
        </span>
      </div>
      {ref_.image_url && (
        <img
          src={ref_.image_url}
          alt="Shared question"
          className="max-h-72 w-full object-contain bg-bg"
        />
      )}
      <div className="space-y-1 px-3 py-2 text-[13px] leading-relaxed text-text">
        {ref_.question_text ? (
          <p className="whitespace-pre-wrap">{ref_.question_text}</p>
        ) : ref_.image_url ? (
          <p className="text-[12px] italic text-text-muted">See image.</p>
        ) : (
          <p className="text-[12px] italic text-text-muted">No text.</p>
        )}
        {sourceLine && (
          <p className="text-[10.5px] uppercase tracking-wider text-text-faint">
            {sourceLine}
          </p>
        )}
      </div>
    </div>
  );
}

function QuestionPicker({
  meId,
  onPick,
  onClose
}: {
  meId: string;
  onPick: (q: QuestionRow) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const all = await db.questions.where('user_id').equals(meId).toArray();
      if (cancelled) return;
      setRows(
        all
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 400)
      );
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [meId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.subject, r.subtopic, r.question_text, r.source_ref]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    );
  }, [q, rows]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        onClick={(e) => e.stopPropagation()}
        className="mx-3 flex max-h-[70vh] w-full max-w-[520px] flex-col overflow-hidden rounded-lg border border-border bg-bg-raised shadow-card"
      >
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <p className="font-display text-[14px] font-semibold text-text">
            Share a question
          </p>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded p-1 text-text-faint hover:text-text"
            aria-label="Close"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </header>
        <div className="border-b border-border px-4 py-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by subject, topic, source, text…"
            autoFocus
            className="block w-full rounded border border-border bg-bg px-3 py-1.5 text-[13px] text-text placeholder:text-text-faint focus:border-accent focus:shadow-[0_0_0_3px_theme(colors.accent.faint)] focus:outline-none"
          />
          <p className="mt-1 text-[10.5px] text-text-faint">
            Only the question is shared. Your outcome, pattern, and root cause
            never leave your journal.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-[12px] text-text-faint">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-[12px] text-text-faint">
              {rows.length === 0
                ? "You haven't logged any questions yet."
                : 'No matches. Try a different filter.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.slice(0, 50).map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onPick(r)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-bg-overlay"
                  >
                    <span
                      className={cn(
                        'mt-1 h-1.5 w-1.5 shrink-0 rounded-full',
                        subjectInk(r.subject).dot
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-text">
                        {r.subject}
                        {r.subtopic ? (
                          <span className="text-text-faint"> · {r.subtopic}</span>
                        ) : null}
                      </p>
                      <p className="line-clamp-2 text-[12px] text-text-muted">
                        {r.question_text ??
                          (r.image_url ? '(image question)' : '(no text)')}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-text-faint">
                        {r.source_ref ?? 'no source'}{' '}
                        {r.source_year ? `· ${r.source_year}` : ''} ·{' '}
                        {formatDate(r.created_at.slice(0, 10), 'dd MMM')}
                      </p>
                    </div>
                    <ArrowUp
                      size={12}
                      strokeWidth={1.75}
                      className="rotate-45 text-text-faint"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function groupByDay(rows: BuddyMessageRow[]): { day: string; rows: BuddyMessageRow[] }[] {
  const out: { day: string; rows: BuddyMessageRow[] }[] = [];
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    const last = out.at(-1);
    if (last && last.day === day) last.rows.push(r);
    else out.push({ day, rows: [r] });
  }
  return out;
}
