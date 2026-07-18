// Re-attempt queue (F3.3): due ladders first, upcoming below. Clean advances
// D3 → D10 → D30 → MASTERED; fail resets to D3. Solve on paper, then report.
// Also surfaces F4.4 queued variations — user picks R/RBS/RBG/W to log an
// outcome, which materialises a synthetic question row (linked to the parent)
// and enters the ladder at D3 for anything not clean.
import { forwardRef, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import type { QuestionRow, ReattemptRow, ReattemptStage, VariationRow, Outcome } from '@/types';
import { db } from '@/lib/db';
import { needsReattempt, recordReattemptResult, scheduleReattempt } from '@/lib/reattempt';
import { writeLocal } from '@/lib/sync';
import { OUTCOME_BY_CODE, OUTCOMES } from '@/lib/constants';
import { cn, formatDate, nowISO, todayISO, plural, uuid } from '@/lib/utils';
import { subjectInk } from '@/lib/subjectInk';
import { useAuth } from '@/hooks/useAuth';
import { useUiStore } from '@/stores/ui';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Empty } from '@/components/ui/Empty';
import VariationDialog from '@/components/shared/VariationDialog';

const TONE_BADGE: Record<'ok' | 'slow' | 'guess' | 'wrong', 'success' | 'warn' | 'guess' | 'danger'> = {
  ok: 'success',
  slow: 'warn',
  guess: 'guess',
  wrong: 'danger'
};

const RUNGS: ReattemptStage[] = ['D3', 'D10', 'D30'];

function Ladder({ stage }: { stage: ReattemptStage }) {
  const idx = RUNGS.indexOf(stage);
  return (
    <span className="flex items-center gap-1" title="Ladder: D3 → D10 → D30 → mastered">
      {RUNGS.map((s, i) => (
        <span
          key={s}
          className={cn(
            'u-num rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            s === stage
              ? 'bg-accent text-white'
              : i < idx || stage === 'MASTERED'
                ? 'bg-success-faint text-success'
                : 'bg-bg-overlay text-text-faint'
          )}
        >
          {s}
        </span>
      ))}
    </span>
  );
}

interface DueCardProps {
  row: ReattemptRow;
  question?: QuestionRow;
  today: string;
  onResult: (row: ReattemptRow, result: 'clean' | 'fail') => void;
  onVariations: (parent: QuestionRow) => void;
}

// forwardRef because AnimatePresence popLayout measures exiting children via ref
const DueCard = forwardRef<HTMLDivElement, DueCardProps>(function DueCard(
  { row, question, today, onResult, onVariations },
  ref
) {
  const ink = question ? subjectInk(question.subject) : null;
  const overdue = row.scheduled_date < today;
  return (
    <motion.div
      ref={ref}
      layout
      initial={false}
      exit={{ opacity: 0, x: 48, transition: { duration: 0.18 } }}
      className="rounded-lg border border-border bg-bg-raised p-4 shadow-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        {question && ink && (
          <span className="flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', ink.dot)} />
            <span className={cn('text-[12px] font-medium', ink.text)}>{question.subject}</span>
          </span>
        )}
        {question && (
          <Badge tone={TONE_BADGE[OUTCOME_BY_CODE[question.outcome].tone]}>
            {question.outcome}
          </Badge>
        )}
        {overdue && <Badge tone="danger">overdue</Badge>}
        <span className="ml-auto">
          <Ladder stage={row.stage} />
        </span>
      </div>

      <p className="mt-3 text-[15px] font-medium leading-snug">
        {question?.pattern_name ? (
          <span className="u-highlight">{question.pattern_name}</span>
        ) : (
          <span className="text-text-faint">untitled mistake</span>
        )}
      </p>
      {question?.trigger_sentence && (
        <p className="mt-1 text-[13px] italic text-text-muted">“{question.trigger_sentence}”</p>
      )}
      <p className="mt-1 text-[11.5px] text-text-faint">
        tagged {question ? formatDate(question.created_at.slice(0, 10), 'dd MMM') : '—'} · due{' '}
        {formatDate(row.scheduled_date, 'dd MMM')}
        {row.history.length > 0 && ` · ${row.history.length} prior ${plural(row.history.length, 'attempt')}`}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        {question ? (
          <button
            type="button"
            onClick={() => onVariations(question)}
            className="flex items-center gap-1 text-[12px] text-text-faint underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            <Sparkles size={11} strokeWidth={1.75} />
            Generate 5 variations
          </button>
        ) : (
          <span className="text-[12px] text-text-faint">Re-solve on paper first, then report.</span>
        )}
        <div className="flex gap-2">
          <Button variant="danger" size="sm" onClick={() => onResult(row, 'fail')}>
            Failed — reset
          </Button>
          <Button variant="primary" size="sm" onClick={() => onResult(row, 'clean')}>
            Solved clean
          </Button>
        </div>
      </div>
    </motion.div>
  );
});

interface VariationCardProps {
  row: VariationRow;
  parent?: QuestionRow;
  onLog: (v: VariationRow, parent: QuestionRow | undefined, outcome: Outcome) => void;
  onSkip: (v: VariationRow) => void;
}

function VariationCard({ row, parent, onLog, onSkip }: VariationCardProps) {
  const ink = parent ? subjectInk(parent.subject) : null;
  return (
    <div className="rounded-lg border border-border bg-bg-raised p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        {ink && (
          <>
            <span className={cn('h-1.5 w-1.5 rounded-full', ink.dot)} />
            <span className={cn('font-medium', ink.text)}>{parent?.subject}</span>
          </>
        )}
        <Badge tone="neutral">variation</Badge>
        {parent?.pattern_name && (
          <span className="text-text-muted">of “{parent.pattern_name}”</span>
        )}
        <span className="ml-auto text-text-faint">
          added {formatDate(row.created_at.slice(0, 10), 'dd MMM')}
        </span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-text">
        {row.generated_text}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-[12px] text-text-faint">
          Solve on paper, then log outcome. Non-clean enters the D3 ladder.
        </span>
        <div className="flex flex-wrap gap-1.5">
          {OUTCOMES.map((o) => (
            <button
              key={o.code}
              type="button"
              onClick={() => onLog(row, parent, o.code)}
              title={o.hint}
              className={cn(
                'rounded border px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
                'border-border bg-bg-overlay text-text-muted hover:border-accent hover:text-accent'
              )}
            >
              {o.code}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onSkip(row)}
            className="rounded border border-border bg-bg-overlay px-2 py-1 text-[11px] font-medium text-text-faint hover:text-text"
          >
            skip
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Reattempts() {
  const { userId } = useAuth();
  const pushToast = useUiStore((s) => s.pushToast);
  const today = todayISO();

  const [variationParent, setVariationParent] = useState<QuestionRow | null>(null);
  const [variationOpen, setVariationOpen] = useState(false);

  const reattempts = useLiveQuery(
    () => (userId ? db.reattempts.where('user_id').equals(userId).toArray() : []),
    [userId]
  );
  const questions = useLiveQuery(
    () => (userId ? db.questions.where('user_id').equals(userId).toArray() : []),
    [userId]
  );
  const variations = useLiveQuery(
    async () => {
      if (!userId) return [] as VariationRow[];
      const rows = await db.variations.where('user_id').equals(userId).toArray();
      return rows
        .filter((v) => v.added_to_reattempt)
        .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
    },
    [userId],
    []
  );

  const qById = useMemo(() => new Map((questions ?? []).map((q) => [q.id, q])), [questions]);

  const { due, upcoming, mastered } = useMemo(() => {
    const open = (reattempts ?? []).filter((r) => r.stage !== 'MASTERED');
    return {
      due: open
        .filter((r) => r.scheduled_date <= today)
        .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
      upcoming: open
        .filter((r) => r.scheduled_date > today)
        .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)),
      mastered: (reattempts ?? []).filter((r) => r.stage === 'MASTERED').length
    };
  }, [reattempts, today]);

  async function onResult(row: ReattemptRow, result: 'clean' | 'fail') {
    const updated = await recordReattemptResult(row, result);
    if (updated.stage === 'MASTERED') {
      pushToast('Mastered — off the mistake surface.', 'success');
    } else if (result === 'clean') {
      pushToast(`Clean. Next rung ${formatDate(updated.scheduled_date, 'dd MMM')}.`, 'success');
    } else {
      pushToast(`Reset to D3 — back ${formatDate(updated.scheduled_date, 'dd MMM')}.`, 'neutral');
    }
  }

  function openVariations(parent: QuestionRow) {
    setVariationParent(parent);
    setVariationOpen(true);
  }

  async function logVariation(v: VariationRow, parent: QuestionRow | undefined, outcome: Outcome) {
    if (!userId) return;
    const now = nowISO();
    const parentRef = parent?.source_ref ? `Variation of ${parent.source_ref}` : 'Variation';
    const synthetic: QuestionRow = {
      id: uuid(),
      user_id: userId,
      session_id: null,
      subject: parent?.subject ?? 'General Aptitude',
      subtopic: parent?.subtopic ?? null,
      source_year: null,
      source_ref: parentRef,
      question_text: v.generated_text,
      image_url: null,
      time_spent_sec: 0,
      target_time_sec: parent?.target_time_sec ?? 120,
      outcome,
      pattern_name: parent?.pattern_name ?? null,
      trigger_sentence: null,
      root_cause: null,
      mark_decision: null,
      mark_correct: null,
      created_at: now
    };
    await writeLocal('questions', synthetic);
    if (needsReattempt(outcome)) {
      await scheduleReattempt(userId, synthetic.id);
    }
    await writeLocal('variations', { ...v, added_to_reattempt: false });
    pushToast(
      needsReattempt(outcome)
        ? `Variation logged (${outcome}). Enters D3 ladder.`
        : `Variation logged (${outcome}). Off the queue.`,
      needsReattempt(outcome) ? 'neutral' : 'success'
    );
  }

  async function skipVariation(v: VariationRow) {
    await writeLocal('variations', { ...v, added_to_reattempt: false });
    pushToast('Variation dropped.', 'neutral');
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Re-attempts"
        description={
          reattempts === undefined
            ? 'Loading…'
            : `${due.length} due · ${upcoming.length} upcoming · ${mastered} mastered${
                variations.length > 0 ? ` · ${variations.length} ${plural(variations.length, 'variation')}` : ''
              }`
        }
      />

      {due.length > 0 ? (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false} mode="popLayout">
            {due.map((r) => (
              <DueCard
                key={r.id}
                row={r}
                question={qById.get(r.question_id)}
                today={today}
                onResult={(row, result) => void onResult(row, result)}
                onVariations={openVariations}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Empty
          title="Nothing due"
          hint="The queue fills as you tag RBS, RBG and W-* questions. First rung lands 3 days after the mistake."
        />
      )}

      {variations.length > 0 && (
        <Card>
          <CardHeader
            title="Queued variations"
            aside={
              <span className="u-num text-[11px] text-text-faint">
                {variations.length} {plural(variations.length, 'item')}
              </span>
            }
          />
          <div className="flex flex-col gap-3 p-4">
            {variations.map((v) => (
              <VariationCard
                key={v.id}
                row={v}
                parent={qById.get(v.parent_question_id)}
                onLog={(row, parent, outcome) => void logVariation(row, parent, outcome)}
                onSkip={(row) => void skipVariation(row)}
              />
            ))}
          </div>
        </Card>
      )}

      {upcoming.length > 0 && (
        <Card>
          <CardHeader title="Upcoming" />
          <div>
            {upcoming.map((r) => {
              const q = qById.get(r.question_id);
              const ink = q ? subjectInk(q.subject) : null;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                >
                  <span className="u-num w-[64px] shrink-0 text-[11px] text-text-muted">
                    {formatDate(r.scheduled_date, 'dd MMM')}
                  </span>
                  {ink && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', ink.dot)} />}
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {q?.pattern_name ?? <span className="text-text-faint">untitled mistake</span>}
                  </span>
                  <Ladder stage={r.stage} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <VariationDialog
        parent={variationParent}
        open={variationOpen}
        onClose={() => setVariationOpen(false)}
      />
    </div>
  );
}
