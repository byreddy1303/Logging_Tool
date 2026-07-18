// /planner — user-defined study plan. One-off + recurring items with a
// per-day completion marker.
//
// Everything writes straight to Supabase (RLS gates by user_id). Kept
// server-side because the digest edge fn reads the same tables at 06:00
// local. Offline planning is nice-to-have and can move to Dexie later.
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Empty } from '@/components/ui/Empty';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/stores/ui';
import { SUBJECTS } from '@/lib/constants';
import { subjectInk } from '@/lib/subjectInk';
import { cn, formatDate, todayISO } from '@/lib/utils';
import type { PlanItemRow, PlanItemCompletionRow, PlanRRuleKind } from '@/types';

type Tab = 'today' | 'week' | 'all';

const RRULE_LABEL: Record<PlanRRuleKind, string> = {
  none: 'One-off',
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly'
};

interface Draft {
  id?: string;
  title: string;
  subject: string;
  notes: string;
  due_date: string;
  rrule_kind: PlanRRuleKind;
  ends_on: string;
  target_min: string;
}

const emptyDraft = (today: string): Draft => ({
  title: '',
  subject: '',
  notes: '',
  due_date: today,
  rrule_kind: 'none',
  ends_on: '',
  target_min: ''
});

export default function Planner() {
  const { userId, sandbox } = useAuth();
  const pushToast = useUiStore((s) => s.pushToast);
  const today = todayISO();
  const [tab, setTab] = useState<Tab>('today');
  const [items, setItems] = useState<PlanItemRow[]>([]);
  const [completions, setCompletions] = useState<PlanItemCompletionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId || sandbox || !supabaseConfigured) return;
    void reload();
  }, [userId, sandbox]); // eslint-disable-line react-hooks/exhaustive-deps

  async function reload() {
    if (!userId) return;
    setLoading(true);
    const [{ data: it }, { data: co }] = await Promise.all([
      supabase
        .from('plan_items')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('due_date', { ascending: true })
        .limit(500),
      supabase
        .from('plan_item_completions')
        .select('*')
        .eq('user_id', userId)
        .gte('on_date', addDays(today, -30))
        .limit(2000)
    ]);
    setItems((it as PlanItemRow[]) ?? []);
    setCompletions((co as PlanItemCompletionRow[]) ?? []);
    setLoading(false);
  }

  const dueToday = useMemo(() => items.filter((i) => itemDueOn(i, today)), [items, today]);
  const week = useMemo(
    () =>
      Array.from({ length: 7 }, (_, k) => {
        const d = addDays(today, k);
        return { day: d, rows: items.filter((i) => itemDueOn(i, d)) };
      }),
    [items, today]
  );
  const doneKey = (id: string, on: string) => `${id}:${on}`;
  const doneSet = useMemo(
    () => new Set(completions.map((c) => doneKey(c.item_id, c.on_date))),
    [completions]
  );

  async function toggleDone(item: PlanItemRow, on: string) {
    if (!userId) return;
    const key = doneKey(item.id, on);
    const isDone = doneSet.has(key);
    if (isDone) {
      const optim = completions.filter((c) => !(c.item_id === item.id && c.on_date === on));
      setCompletions(optim);
      const { error } = await supabase
        .from('plan_item_completions')
        .delete()
        .eq('item_id', item.id)
        .eq('on_date', on);
      if (error) {
        pushToast(error.message, 'neutral');
        void reload();
      }
    } else {
      const row: PlanItemCompletionRow = {
        item_id: item.id,
        user_id: userId,
        on_date: on,
        completed_at: new Date().toISOString()
      };
      setCompletions([...completions, row]);
      const { error } = await supabase.from('plan_item_completions').insert(row);
      if (error) {
        pushToast(error.message, 'neutral');
        void reload();
      }
    }
  }

  async function submitDraft(e: FormEvent) {
    e.preventDefault();
    if (!draft || !userId) return;
    const title = draft.title.trim();
    if (title.length === 0) {
      pushToast('Give the task a title.', 'neutral');
      return;
    }
    setSaving(true);
    const payload = {
      user_id: userId,
      title,
      subject: draft.subject || null,
      notes: draft.notes.trim() || null,
      due_date: draft.due_date || today,
      rrule_kind: draft.rrule_kind,
      ends_on: draft.rrule_kind === 'none' ? null : (draft.ends_on || null),
      target_min: draft.target_min ? Math.max(5, Math.min(480, Number(draft.target_min))) : null
    };
    let error;
    if (draft.id) {
      ({ error } = await supabase
        .from('plan_items')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', draft.id));
    } else {
      ({ error } = await supabase.from('plan_items').insert(payload));
    }
    setSaving(false);
    if (error) {
      pushToast(error.message, 'neutral');
      return;
    }
    setDraft(null);
    void reload();
  }

  async function removeItem(id: string) {
    if (!window.confirm('Delete this item? Completion history is preserved.')) return;
    const { error } = await supabase
      .from('plan_items')
      .update({ is_archived: true })
      .eq('id', id);
    if (error) {
      pushToast(error.message, 'neutral');
      return;
    }
    void reload();
  }

  if (sandbox || !supabaseConfigured) {
    return (
      <div>
        <PageHeader title="Planner" description="Your custom plan for the week." />
        <Card>
          <CardBody>
            <p className="text-[12.5px] text-text-muted">
              Sandbox mode. Planner writes go to Supabase; sign in with a real account to use it.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Planner"
        description="Your own list. Recurring or one-off. The daily digest picks up whatever's due today."
        actions={
          <Button variant="primary" size="sm" onClick={() => setDraft(emptyDraft(today))}>
            <Plus size={12} strokeWidth={2} className="mr-1" />
            New item
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {(['today', 'week', 'all'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-full border px-3 py-1 text-[12px] transition-colors',
              tab === t
                ? 'border-transparent bg-accent-faint font-semibold text-accent'
                : 'border-border text-text-muted hover:border-border-hover hover:text-text'
            )}
          >
            {t === 'today' ? 'Today' : t === 'week' ? 'This week' : 'All items'}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-[12px] text-text-faint">Loading…</p>
          </CardBody>
        </Card>
      ) : tab === 'today' ? (
        <Card>
          <CardHeader title={`Today · ${formatDate(today, 'EEE, dd MMM')}`} />
          {dueToday.length === 0 ? (
            <Empty
              title="Nothing scheduled for today"
              hint={items.length === 0 ? 'Add your first item to shape the day.' : 'Nice, room to breathe.'}
              className="border-0 py-8"
            />
          ) : (
            <ul className="divide-y divide-border">
              {dueToday.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  on={today}
                  done={doneSet.has(doneKey(i.id, today))}
                  onToggle={() => void toggleDone(i, today)}
                  onEdit={() => setDraft(itemToDraft(i))}
                  onDelete={() => void removeItem(i.id)}
                />
              ))}
            </ul>
          )}
        </Card>
      ) : tab === 'week' ? (
        <div className="flex flex-col gap-3">
          {week.map((chunk) => (
            <Card key={chunk.day}>
              <CardHeader
                title={formatDate(chunk.day, 'EEE, dd MMM')}
                aside={
                  <span className="text-[11px] text-text-faint">
                    {chunk.rows.length} item{chunk.rows.length === 1 ? '' : 's'}
                  </span>
                }
              />
              {chunk.rows.length === 0 ? (
                <p className="px-4 py-4 text-[12px] text-text-faint">Nothing scheduled.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {chunk.rows.map((i) => (
                    <ItemRow
                      key={`${i.id}-${chunk.day}`}
                      item={i}
                      on={chunk.day}
                      done={doneSet.has(doneKey(i.id, chunk.day))}
                      onToggle={() => void toggleDone(i, chunk.day)}
                      onEdit={() => setDraft(itemToDraft(i))}
                      onDelete={() => void removeItem(i.id)}
                    />
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader title="All items" />
          {items.length === 0 ? (
            <Empty title="Nothing yet" className="border-0 py-8" />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  {i.subject && (
                    <span
                      className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        subjectInk(i.subject).dot
                      )}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-text">{i.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-text-faint">
                      {RRULE_LABEL[i.rrule_kind]} · starts {formatDate(i.due_date, 'dd MMM')}
                      {i.ends_on ? ` · ends ${formatDate(i.ends_on, 'dd MMM')}` : ''}
                      {i.target_min ? ` · ${i.target_min}m` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDraft(itemToDraft(i))}
                    className="rounded p-1 text-text-faint hover:bg-bg-overlay hover:text-text"
                    aria-label="Edit"
                  >
                    <Pencil size={13} strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeItem(i.id)}
                    className="rounded p-1 text-text-faint hover:bg-danger-faint hover:text-danger"
                    aria-label="Delete"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <AnimatePresence>
        {draft && (
          <DraftModal
            draft={draft}
            saving={saving}
            onChange={setDraft}
            onSubmit={submitDraft}
            onClose={() => setDraft(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ItemRow({
  item,
  done,
  onToggle,
  onEdit,
  onDelete
}: {
  item: PlanItemRow;
  on: string;
  done: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          done
            ? 'border-success bg-success text-white'
            : 'border-border bg-bg-raised text-transparent hover:border-border-hover'
        )}
        aria-label={done ? 'Mark not done' : 'Mark done'}
      >
        <Check size={13} strokeWidth={3} />
      </button>
      {item.subject && (
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', subjectInk(item.subject).dot)}
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-[13.5px] font-medium',
            done ? 'text-text-faint line-through' : 'text-text'
          )}
        >
          {item.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-text-faint">
          {item.subject ?? 'no subject'} · {RRULE_LABEL[item.rrule_kind]}
          {item.target_min ? ` · ${item.target_min}m target` : ''}
          {item.notes ? ` · ${item.notes.slice(0, 60)}${item.notes.length > 60 ? '…' : ''}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="rounded p-1 text-text-faint hover:bg-bg-overlay hover:text-text"
        aria-label="Edit"
      >
        <Pencil size={13} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-1 text-text-faint hover:bg-danger-faint hover:text-danger"
        aria-label="Delete"
      >
        <Trash2 size={13} strokeWidth={1.75} />
      </button>
    </li>
  );
}

function DraftModal({
  draft,
  saving,
  onChange,
  onSubmit,
  onClose
}: {
  draft: Draft;
  saving: boolean;
  onChange: (d: Draft) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        onClick={(e) => e.stopPropagation()}
        className="u-panel relative w-full max-w-[480px] overflow-hidden"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded p-1 text-text-faint hover:bg-bg-overlay hover:text-text"
        >
          <X size={14} strokeWidth={1.75} />
        </button>
        <form onSubmit={onSubmit} className="u-margin-line px-6 py-6">
          <p className="u-label text-accent">{draft.id ? 'edit' : 'new'}</p>
          <h2 className="mt-1 font-display text-[22px] font-bold leading-tight text-text">
            Plan item
          </h2>
          <div className="mt-5 flex flex-col gap-3">
            <div>
              <label className="u-label mb-1 block">Title</label>
              <Input
                value={draft.title}
                onChange={(e) => onChange({ ...draft, title: e.target.value.slice(0, 140) })}
                placeholder="Solve 20 DBMS PYQs"
                autoFocus
                maxLength={140}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="u-label mb-1 block">Subject (optional)</label>
                <select
                  value={draft.subject}
                  onChange={(e) => onChange({ ...draft, subject: e.target.value })}
                  className="block h-10 w-full rounded border border-border bg-bg-raised px-3 text-[13px] text-text focus:border-accent focus:shadow-[0_0_0_3px_theme(colors.accent.faint)] focus:outline-none"
                >
                  <option value="">—</option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="u-label mb-1 block">Target minutes</label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  value={draft.target_min}
                  onChange={(e) => onChange({ ...draft, target_min: e.target.value })}
                  placeholder="e.g. 45"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="u-label mb-1 block">Start on</label>
                <Input
                  type="date"
                  value={draft.due_date}
                  onChange={(e) => onChange({ ...draft, due_date: e.target.value })}
                />
              </div>
              <div>
                <label className="u-label mb-1 block">Repeats</label>
                <select
                  value={draft.rrule_kind}
                  onChange={(e) =>
                    onChange({ ...draft, rrule_kind: e.target.value as PlanRRuleKind })
                  }
                  className="block h-10 w-full rounded border border-border bg-bg-raised px-3 text-[13px] text-text focus:border-accent focus:shadow-[0_0_0_3px_theme(colors.accent.faint)] focus:outline-none"
                >
                  <option value="none">One-off</option>
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays (Mon–Fri)</option>
                  <option value="weekly">Weekly (same day)</option>
                </select>
              </div>
            </div>
            {draft.rrule_kind !== 'none' && (
              <div>
                <label className="u-label mb-1 block">Ends on (optional)</label>
                <Input
                  type="date"
                  value={draft.ends_on}
                  onChange={(e) => onChange({ ...draft, ends_on: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="u-label mb-1 block">Notes (optional)</label>
              <Textarea
                rows={2}
                value={draft.notes}
                onChange={(e) => onChange({ ...draft, notes: e.target.value.slice(0, 800) })}
                maxLength={800}
                placeholder="Sections to focus on, anything to remember"
              />
            </div>
          </div>
          <div className="mt-6 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving || draft.title.trim().length === 0}>
              {saving ? 'Saving…' : draft.id ? 'Save' : 'Add item'}
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// -- helpers -----------------------------------------------------------------

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoDayOfWeek(iso: string): number {
  // 1..7 with Mon=1 (matches Postgres isodow)
  const d = new Date(iso + 'T00:00:00Z');
  const js = d.getUTCDay(); // 0..6 with Sun=0
  return js === 0 ? 7 : js;
}

function itemDueOn(item: PlanItemRow, on: string): boolean {
  if (item.is_archived) return false;
  if (on < item.due_date) return false;
  if (item.ends_on && on > item.ends_on) return false;
  switch (item.rrule_kind) {
    case 'none':
      return on === item.due_date;
    case 'daily':
      return true;
    case 'weekdays':
      return isoDayOfWeek(on) <= 5;
    case 'weekly':
      return isoDayOfWeek(on) === isoDayOfWeek(item.due_date);
    default:
      return false;
  }
}

function itemToDraft(i: PlanItemRow): Draft {
  return {
    id: i.id,
    title: i.title,
    subject: i.subject ?? '',
    notes: i.notes ?? '',
    due_date: i.due_date,
    rrule_kind: i.rrule_kind,
    ends_on: i.ends_on ?? '',
    target_min: i.target_min?.toString() ?? ''
  };
}
