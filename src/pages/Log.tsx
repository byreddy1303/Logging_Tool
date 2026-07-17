// Standalone logging page — every field the tag flow captures is available
// here for questions solved outside a timed session (browsing a PYQ paper,
// scrolling GATE Overflow, thinking through a doubt). Date defaults to
// today, but the user can back-date if they're catching up.
//
// A "just logged" list at the bottom shows the current session of edits
// so nothing feels lost. Old entries are also editable/deletable from here.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'motion/react';
import { CheckCircle2, Pencil } from 'lucide-react';
import type { QuestionRow } from '@/types';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { db } from '@/lib/db';
import { writeLocal, deleteLocal } from '@/lib/sync';
import { needsReattempt, scheduleReattempt } from '@/lib/reattempt';
import { useAuth } from '@/hooks/useAuth';
import { OUTCOME_BY_CODE } from '@/lib/constants';
import { cn, formatDate, nowISO, plural, secondsToClock, todayISO, uuid } from '@/lib/utils';
import { subjectInk } from '@/lib/subjectInk';
import QuestionEditor, { DeleteBar } from '@/components/shared/QuestionEditor';
import {
  applyDraftToRow,
  draftFromRow,
  emptyDraft,
  type EditorDraft
} from '@/components/shared/questionDraft';

const DEFAULT_SUBJECT = 'Discrete Mathematics';

async function reconcilePattern(userId: string, subject: string, name: string) {
  const count = await db.questions
    .where('user_id')
    .equals(userId)
    .filter((q) => q.pattern_name === name)
    .count();
  const existing = await db.patterns.where('[user_id+name]').equals([userId, name]).first();
  if (existing) {
    await writeLocal('patterns', { ...existing, count });
  } else {
    await writeLocal('patterns', {
      id: uuid(),
      user_id: userId,
      name,
      subject,
      count,
      is_reflexed: false,
      mastery_level: 0,
      first_seen_at: nowISO()
    });
  }
}

export default function Log() {
  const { userId } = useAuth();
  const today = todayISO();

  const [draft, setDraft] = useState<EditorDraft>(() => emptyDraft(DEFAULT_SUBJECT, today));
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null); // last-saved id

  const [editRow, setEditRow] = useState<QuestionRow | null>(null);
  const [editDraft, setEditDraft] = useState<EditorDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const recent = useLiveQuery(
    async () => {
      if (!userId) return [] as QuestionRow[];
      const rows = await db.questions
        .where('user_id')
        .equals(userId)
        .filter((q) => q.session_id === null)
        .sortBy('created_at');
      return rows.reverse().slice(0, 25);
    },
    [userId],
    []
  );

  const dayCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of recent) {
      const day = q.created_at.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    return map;
  }, [recent]);

  const canSave = draft.outcome !== undefined && !!draft.subject && draft.timeSpentSec >= 0;

  async function saveNew() {
    if (!userId || !canSave || saving) return;
    setSaving(true);
    try {
      // Build a blank row and merge the draft — this reuses the same field-mapping
      // as the Journal edit path (source_ref/target_time/etc.) so nothing drifts.
      const nowIso = nowISO();
      const skeleton: QuestionRow = {
        id: uuid(),
        user_id: userId,
        session_id: null,
        subject: draft.subject,
        subtopic: null,
        source_year: null,
        source_ref: null,
        question_text: null,
        image_url: null,
        time_spent_sec: 0,
        target_time_sec: 120,
        outcome: 'R',
        pattern_name: null,
        trigger_sentence: null,
        root_cause: null,
        mark_decision: null,
        mark_correct: null,
        // Preserve the wall-clock so back-dated rows still get a valid ISO.
        created_at: `${draft.createdDate}T${nowIso.slice(11)}`
      };
      const row = applyDraftToRow(skeleton, draft);
      await writeLocal('questions', row);
      if (row.pattern_name) await reconcilePattern(userId, row.subject, row.pattern_name);
      if (needsReattempt(row.outcome)) await scheduleReattempt(userId, row.id);
      setFlash(row.id);
      // Reset for the next entry but keep subject / source kind sticky —
      // most people log multiple questions from the same source in a row.
      setDraft((d) => ({
        ...emptyDraft(d.subject, today),
        sourceKind: d.sourceKind,
        sourceYear: d.sourceYear,
        sourceSet: d.sourceSet,
        format: d.format,
        marks: d.marks
      }));
      setTimeout(() => setFlash(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(row: QuestionRow) {
    setEditRow(row);
    setEditDraft(draftFromRow(row));
  }

  async function saveEdit() {
    if (!editRow || !editDraft) return;
    setEditSaving(true);
    try {
      const merged = applyDraftToRow(editRow, editDraft);
      await writeLocal('questions', merged);
      setEditRow(null);
      setEditDraft(null);
    } finally {
      setEditSaving(false);
    }
  }

  async function removeRow() {
    if (!editRow) return;
    setDeleting(true);
    try {
      await deleteLocal('questions', editRow.id);
      setEditRow(null);
      setEditDraft(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Log a question"
        description="One-off entries outside a timed session. Same fields as Journal — every one is optional except subject and outcome."
      />

      <Card>
        <CardHeader
          title="New entry"
          aside={
            flash && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1 text-[12px] text-success"
              >
                <CheckCircle2 size={12} strokeWidth={2} />
                saved
              </motion.span>
            )
          }
        />
        <CardBody className="flex flex-col gap-4">
          <QuestionEditor draft={draft} onChange={setDraft} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-[12px] text-text-faint">
              Date defaults to today · Subject and outcome are enough — leave the rest blank if
              you don't have it.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setDraft(emptyDraft(DEFAULT_SUBJECT, today))}
                disabled={saving}
              >
                Reset
              </Button>
              <Button variant="primary" onClick={() => void saveNew()} disabled={!canSave || saving}>
                {saving ? 'Saving…' : 'Log question'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Just logged"
          aside={
            recent.length > 0 ? (
              <span className="u-num text-[12px] text-text-faint">
                {recent.length} recent · {dayCounts.size}{' '}
                {plural(dayCounts.size, 'day')}
              </span>
            ) : undefined
          }
        />
        {recent.length === 0 ? (
          <Empty
            title="Nothing standalone yet"
            hint="Entries saved here appear below and in the Journal — where a source-kind filter separates session logs from standalone ones."
            className="border-0 py-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-text-muted">
                  <th className="px-3 py-2 font-mono">Date</th>
                  <th className="px-3 py-2 font-mono">Subject</th>
                  <th className="hidden px-3 py-2 font-mono sm:table-cell">Subtopic</th>
                  <th className="px-3 py-2 font-mono">Outcome</th>
                  <th className="hidden px-3 py-2 font-mono md:table-cell">Source</th>
                  <th className="px-3 py-2 font-mono">Pattern</th>
                  <th className="hidden px-3 py-2 text-right font-mono sm:table-cell">Time</th>
                  <th className="w-[52px] px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((q) => {
                  const spec = OUTCOME_BY_CODE[q.outcome];
                  const ink = subjectInk(q.subject);
                  const over = q.time_spent_sec > q.target_time_sec;
                  return (
                    <tr key={q.id} className="hover:bg-bg-overlay/40">
                      <td className="u-num whitespace-nowrap px-3 py-2 text-[11px] text-text-faint">
                        {formatDate(q.created_at.slice(0, 10), 'dd MMM yy')}
                      </td>
                      <td className="max-w-[180px] px-3 py-2">
                        <span className="flex items-center gap-1.5">
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', ink.dot)} />
                          <span className="truncate text-[12px] text-text-muted">{q.subject}</span>
                        </span>
                      </td>
                      <td className="hidden max-w-[180px] px-3 py-2 text-[12px] text-text-muted sm:table-cell">
                        <span className="truncate">
                          {q.subtopic ?? <span className="text-text-faint">—</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          tone={
                            spec.tone === 'ok'
                              ? 'success'
                              : spec.tone === 'slow'
                                ? 'warn'
                                : spec.tone === 'guess'
                                  ? 'guess'
                                  : 'danger'
                          }
                        >
                          {q.outcome}
                        </Badge>
                      </td>
                      <td className="hidden max-w-[220px] px-3 py-2 text-[12px] text-text-muted md:table-cell">
                        <span className="truncate">
                          {q.source_ref ?? <span className="text-text-faint">—</span>}
                        </span>
                      </td>
                      <td className="max-w-[240px] px-3 py-2">
                        <span className="truncate">
                          {q.pattern_name ?? (
                            <span className="text-text-faint">no pattern</span>
                          )}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'u-num hidden px-3 py-2 text-right text-[12px] sm:table-cell',
                          over ? 'text-warn' : 'text-text-muted'
                        )}
                      >
                        {secondsToClock(q.time_spent_sec)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(q)}
                          aria-label="Edit entry"
                          className="rounded p-1 text-text-faint transition-colors hover:bg-bg-overlay hover:text-accent"
                        >
                          <Pencil size={13} strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={!!editRow && !!editDraft}
        onClose={() => {
          if (editSaving || deleting) return;
          setEditRow(null);
          setEditDraft(null);
        }}
        title="Edit entry"
        className="max-w-2xl"
      >
        {editDraft && (
          <div className="flex flex-col gap-4">
            <QuestionEditor draft={editDraft} onChange={setEditDraft} />
            <DeleteBar onDelete={() => void removeRow()} />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditRow(null);
                  setEditDraft(null);
                }}
                disabled={editSaving || deleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void saveEdit()}
                disabled={editSaving || deleting}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
