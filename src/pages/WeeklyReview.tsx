// F5.1 — Weekly review, five screens. The LLM synthesis pane on step 5 stays
// locked until the user has committed steps 2–4 (root cause, weakest concept,
// this week's fix). LLM assist itself is deferred (S18–S24) — until then step 5
// explains what will land once the router is wired.
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'motion/react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, LockKeyhole, Sparkles } from 'lucide-react';
import type { WeeklyReviewRow } from '@/types';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { Empty } from '@/components/ui/Empty';
import { db } from '@/lib/db';
import { useAuth } from '@/hooks/useAuth';
import { writeLocal } from '@/lib/sync';
import {
  summarizeWeek,
  synthesisUnlocked,
  weeklyDraftFingerprint,
  type WeeklyDataSummary,
  type WeeklyDraft
} from '@/lib/analysis';
import { cn, formatDate, nowISO, plural, uuid, weekStartISO } from '@/lib/utils';
import { subjectInk } from '@/lib/subjectInk';
import { ROOT_CAUSES } from '@/lib/constants';

export type WeeklyStep = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS: { id: WeeklyStep; label: string }[] = [
  { id: 1, label: 'this week' },
  { id: 2, label: 'root cause' },
  { id: 3, label: 'weakest concept' },
  { id: 4, label: 'the fix' },
  { id: 5, label: 'synthesis' }
];

type Draft = WeeklyDraft;

const EMPTY_DRAFT: Draft = {
  root_cause_summary: '',
  weakest_concept: '',
  this_weeks_fix: ''
};

export default function WeeklyReview() {
  const { userId } = useAuth();
  const weekStart = weekStartISO();

  const questions = useLiveQuery(
    async () => (userId ? db.questions.where('user_id').equals(userId).toArray() : []),
    [userId],
    []
  );

  const existing = useLiveQuery(
    async () => {
      if (!userId) return null;
      const row = await db.weekly_reviews
        .where('[user_id+week_start]')
        .equals([userId, weekStart])
        .first();
      return row ?? null;
    },
    [userId, weekStart],
    undefined
  );

  const [step, setStep] = useState<WeeklyStep>(1);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing === undefined) return;
    if (existing) {
      const hydrated: Draft = {
        root_cause_summary: existing.root_cause_summary ?? '',
        weakest_concept: existing.weakest_concept ?? '',
        this_weeks_fix: existing.this_weeks_fix ?? ''
      };
      setDraft(hydrated);
      setSavedFingerprint(weeklyDraftFingerprint(hydrated));
    }
  }, [existing]);

  const summary: WeeklyDataSummary = useMemo(
    () => summarizeWeek(questions, weekStart),
    [questions, weekStart]
  );

  const unlocked = synthesisUnlocked(draft, savedFingerprint);
  const currentDirty = weeklyDraftFingerprint(draft) !== savedFingerprint;

  function requireOnStep(): string | null {
    if (step === 2 && !draft.root_cause_summary.trim())
      return 'Write one sentence naming the pattern behind this week\'s misses.';
    if (step === 3 && !draft.weakest_concept.trim())
      return 'Name the single weakest concept — the one you\'d hate to see on the paper.';
    if (step === 4 && !draft.this_weeks_fix.trim())
      return 'Commit to ONE concrete action for the coming week.';
    return null;
  }

  function goNext() {
    setError(null);
    if (step === 5) return;
    if (step >= 2 && step <= 4) {
      const problem = requireOnStep();
      if (problem) {
        setError(problem);
        return;
      }
    }
    setStep((s) => (Math.min(5, s + 1) as WeeklyStep));
  }

  function goBack() {
    setError(null);
    if (step === 1) return;
    setStep((s) => (Math.max(1, s - 1) as WeeklyStep));
  }

  async function save() {
    if (!userId) return;
    const problem =
      (!draft.root_cause_summary.trim() && 'root cause') ||
      (!draft.weakest_concept.trim() && 'weakest concept') ||
      (!draft.this_weeks_fix.trim() && 'this week\'s fix');
    if (problem) {
      setError(`Fill in ${problem} before saving.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const now = nowISO();
      const row: WeeklyReviewRow = existing
        ? {
            ...existing,
            root_cause_summary: draft.root_cause_summary.trim(),
            weakest_concept: draft.weakest_concept.trim(),
            this_weeks_fix: draft.this_weeks_fix.trim()
          }
        : {
            id: uuid(),
            user_id: userId,
            week_start: weekStart,
            root_cause_summary: draft.root_cause_summary.trim(),
            weakest_concept: draft.weakest_concept.trim(),
            this_weeks_fix: draft.this_weeks_fix.trim(),
            llm_synthesis: null,
            created_at: now
          };
      await writeLocal('weekly_reviews', row);
      setSavedFingerprint(weeklyDraftFingerprint(draft));
      setStep(5);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Weekly review"
        description={
          <>
            Week of <span className="u-num">{formatDate(weekStart, 'dd MMM')}</span> —{' '}
            <span className="u-num">{formatDate(summary.weekEnd, 'dd MMM yy')}</span>
            {savedFingerprint && (
              <Badge tone="success" className="ml-2 align-middle">
                Saved
              </Badge>
            )}
          </>
        }
      />

      <Card>
        <CardBody className="flex flex-wrap items-center gap-3">
          <ol className="flex flex-wrap items-center gap-1.5">
            {STEP_LABELS.map((s, i) => {
              const done = s.id < step || (s.id === 5 && unlocked);
              const active = s.id === step;
              const locked = s.id === 5 && !unlocked;
              return (
                <li key={s.id} className="flex items-center gap-1.5">
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={cn('h-px w-3', done || active ? 'bg-accent/40' : 'bg-border')}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (locked) return;
                      setStep(s.id);
                    }}
                    disabled={locked}
                    className={cn(
                      'flex h-6 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
                      active
                        ? 'bg-accent text-white'
                        : done
                          ? 'bg-accent-faint text-accent'
                          : 'bg-bg-overlay text-text-faint',
                      locked && 'cursor-not-allowed'
                    )}
                  >
                    <span>{s.id}.</span> {s.label}
                    {locked && <LockKeyhole size={10} strokeWidth={2} />}
                  </button>
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>

      <motion.div
        key={step}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        {step === 1 && <DataStep summary={summary} />}
        {step === 2 && (
          <NarrativeStep
            label="Root cause of this week's misses"
            hint="One sentence. The pattern behind the mistakes — not what the concept was, but why the wrong answer felt right."
            multiline
            value={draft.root_cause_summary}
            onChange={(v) => setDraft((d) => ({ ...d, root_cause_summary: v }))}
            placeholder="e.g. I keep confusing weak-entity keys with foreign keys — I reach for FK by reflex whenever I see 'depends on'."
            causeSuggestions
          />
        )}
        {step === 3 && (
          <NarrativeStep
            label="Weakest concept"
            hint="The single node you'd hate to see on the paper. Concept, not chapter."
            value={draft.weakest_concept}
            onChange={(v) => setDraft((d) => ({ ...d, weakest_concept: v }))}
            placeholder="e.g. Cache line replacement policies under set-associative mapping"
          />
        )}
        {step === 4 && (
          <NarrativeStep
            label="This week's ONE fix"
            hint="Actionable, testable. Not 'study harder'. Something you can point at on Sunday and say done/not done."
            value={draft.this_weeks_fix}
            onChange={(v) => setDraft((d) => ({ ...d, this_weeks_fix: v }))}
            placeholder="e.g. Re-derive LRU vs. FIFO vs. optimal for the three GATE 2020 cache questions, timed."
          />
        )}
        {step === 5 && <SynthesisStep unlocked={unlocked} summary={summary} draft={draft} />}
      </motion.div>

      <Card>
        <CardBody className="flex flex-col gap-2">
          {error && (
            <p className="flex items-center gap-1.5 text-[12px] text-danger">
              <AlertCircle size={12} strokeWidth={2} />
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={goBack} disabled={step === 1}>
              <ArrowLeft size={14} strokeWidth={1.75} className="mr-1" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              {step === 4 && (
                <Button
                  variant="primary"
                  onClick={() => void save()}
                  disabled={saving}
                >
                  {saving ? 'Saving…' : currentDirty ? 'Save & unlock synthesis' : 'Save'}
                </Button>
              )}
              {step !== 5 && step !== 4 && (
                <Button variant="primary" onClick={goNext}>
                  Next
                  <ArrowRight size={14} strokeWidth={1.75} className="ml-1" />
                </Button>
              )}
              {step === 5 && (
                <Button variant="ghost" onClick={goBack}>
                  Revise
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function DataStep({ summary }: { summary: WeeklyDataSummary }) {
  if (summary.totalQ === 0) {
    return (
      <Empty
        title="No questions logged this week"
        hint="Weekly review looks at what you tagged Mon–Sun. Solve, tag, come back."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="This week's data" />
        <CardBody>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <DataCell label="Total Q" value={summary.totalQ} color="text-text" />
            <DataCell label="Clean (R)" value={summary.clean} color="text-success" />
            <DataCell label="Slow (RBS)" value={summary.slow} color="text-warn" />
            <DataCell label="Guess (RBG)" value={summary.guess} color="text-guess" />
            <DataCell label="Wrong (W-*)" value={summary.wrong} color="text-danger" />
            <DataCell
              label="Concept (W-C)"
              value={summary.byOutcome['W-C']}
              color="text-danger"
              muted
            />
            <DataCell
              label="Execution (W-E)"
              value={summary.byOutcome['W-E']}
              color="text-danger"
              muted
            />
            <DataCell
              label="Reading (W-R)"
              value={summary.byOutcome['W-R']}
              color="text-danger"
              muted
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Subjects — where the misses landed" />
        <CardBody>
          {summary.bySubject.length === 0 ? (
            <p className="text-[13px] text-text-faint">No subjects tagged this week.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {summary.bySubject.map((s) => {
                const ink = subjectInk(s.subject);
                const wrongPct =
                  s.count === 0 ? 0 : Math.round((s.wrongish / s.count) * 100);
                return (
                  <li key={s.subject} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2 text-[13px]">
                      <span className={cn('h-1.5 w-1.5 rounded-full', ink.dot)} />
                      {s.subject}
                    </span>
                    <span className="u-num text-[12px] text-text-muted">
                      {s.wrongish}/{s.count} not clean
                      <span className="ml-2 text-text-faint">({wrongPct}%)</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {summary.topPatterns.length > 0 && (
        <Card>
          <CardHeader title="Recurring patterns" />
          <CardBody>
            <div className="flex flex-wrap gap-1.5">
              {summary.topPatterns.map((p) => (
                <Badge key={p.name} tone="neutral">
                  {p.name} ×{p.count}
                </Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {Object.keys(summary.byRootCause).length > 0 && (
        <Card>
          <CardHeader title="Root causes chosen" />
          <CardBody>
            <div className="flex flex-wrap gap-1.5">
              {ROOT_CAUSES.filter((rc) => (summary.byRootCause[rc.value] ?? 0) > 0).map((rc) => (
                <Badge key={rc.value} tone="neutral">
                  {rc.label} ×{summary.byRootCause[rc.value]}
                </Badge>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function DataCell({
  label,
  value,
  color,
  muted = false
}: {
  label: string;
  value: number;
  color: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded border border-border bg-bg-overlay/40 px-3 py-2">
      <span className="u-label">{label}</span>
      <span
        className={cn(
          'u-num text-[20px] font-semibold leading-none',
          value > 0 ? color : 'text-text-faint',
          muted && 'text-[16px]'
        )}
      >
        {value}
      </span>
    </div>
  );
}

function NarrativeStep({
  label,
  hint,
  placeholder,
  value,
  onChange,
  multiline = false,
  causeSuggestions = false
}: {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  causeSuggestions?: boolean;
}) {
  return (
    <Card>
      <CardHeader title={label} />
      <CardBody className="flex flex-col gap-3">
        <p className="text-[12px] text-text-faint">{hint}</p>
        {multiline ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            autoFocus
          />
        ) : (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        )}
        {causeSuggestions && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="u-label text-text-faint">frame it as</span>
            {ROOT_CAUSES.map((rc) => (
              <Badge key={rc.value} tone="neutral">
                {rc.label}
              </Badge>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function SynthesisStep({
  unlocked,
  summary,
  draft
}: {
  unlocked: boolean;
  summary: WeeklyDataSummary;
  draft: Draft;
}) {
  if (!unlocked) {
    return (
      <Card>
        <CardHeader title="LLM synthesis" />
        <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
          <LockKeyhole size={20} strokeWidth={1.75} className="text-text-faint" />
          <p className="text-[13px] text-text-muted">
            Complete steps 2–4 and save. The second opinion opens once your own read is written.
          </p>
          <p className="text-[12px] text-text-faint">
            This is by design — the model reacts to your conclusion; it does not write it for you.
          </p>
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader
        title="LLM synthesis — second opinion"
        aside={
          <span className="flex items-center gap-1 text-[11px] text-accent">
            <Sparkles size={12} strokeWidth={1.75} />
            unlocked
          </span>
        }
      />
      <CardBody className="flex flex-col gap-3">
        <p className="flex items-start gap-2 rounded border border-warn/30 bg-warn-faint px-3 py-2 text-[12px] text-text">
          <AlertCircle size={12} strokeWidth={2} className="mt-0.5 shrink-0 text-warn" />
          Provider routing lands in S18–S24. For now, this pane echoes back the review payload
          so nothing is lost — plug in a key and it goes live without touching this page.
        </p>
        <details className="rounded border border-border bg-bg-overlay/40 px-3 py-2 text-[12px]">
          <summary className="cursor-pointer text-text-muted">
            <CheckCircle2 size={12} strokeWidth={2} className="mr-1 inline text-success" />
            Prompt payload (what will be sent to Gemini 2.5 Pro)
          </summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-text-muted">{JSON.stringify(
            {
              week_start: summary.weekStart,
              root_cause_summary: draft.root_cause_summary,
              weakest_concept: draft.weakest_concept,
              this_weeks_fix: draft.this_weeks_fix,
              data: {
                total: summary.totalQ,
                clean: summary.clean,
                slow: summary.slow,
                guess: summary.guess,
                wrong: summary.wrong,
                bySubject: summary.bySubject,
                byRootCause: summary.byRootCause,
                topPatterns: summary.topPatterns
              }
            },
            null,
            2
          )}</pre>
        </details>
        <p className="text-[13px] text-text-muted">
          Meanwhile — your own conclusion is what matters. Read it back after two days and see if
          it still feels true. If it does, the fix is likely right. If it doesn't,{' '}
          {plural(summary.totalQ, 'this week\'s question', 'this week\'s questions')} will tell
          you a different story next Sunday.
        </p>
      </CardBody>
    </Card>
  );
}
