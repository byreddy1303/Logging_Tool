// F5.4 — MARK / SKIP / 50-50 calibration under -1/3 negative marking.
// Shows per-subject accuracy + expected value + a nudge on whether to
// raise/lower confidence threshold. Also lets the user quickly edit
// mark_decision / mark_correct on questions that are missing them.
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Check, ChevronDown, Info, MinusCircle, X } from 'lucide-react';
import type { QuestionRow } from '@/types';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/db';
import { writeLocal } from '@/lib/sync';
import { useAuth } from '@/hooks/useAuth';
import { calibrationBySubject, calibrationOverall, type CalibrationRow } from '@/lib/analysis';
import { cn, formatDate, plural } from '@/lib/utils';
import { subjectInk } from '@/lib/subjectInk';
import { MARK_DECISIONS, OUTCOME_BY_CODE } from '@/lib/constants';

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return `${Math.round(v * 100)}%`;
}

function fmtEV(v: number): string {
  return v.toFixed(2);
}

const RECOMMENDATION_COPY: Record<CalibrationRow['recommendation'], { label: string; hint: string; tone: 'success' | 'warn' | 'neutral' }> = {
  raise: {
    label: 'Raise threshold — skip more',
    hint: 'Accuracy < 40% and EV negative. You are gambling. Only MARK when you can justify.',
    tone: 'warn'
  },
  lower: {
    label: 'Lower threshold — mark more',
    hint: 'Accuracy > 80% and EV > 0.6. You are leaving points on the table. Trust the guess a little.',
    tone: 'success'
  },
  hold: {
    label: 'Hold — calibration is fine',
    hint: 'Neither over- nor under-confident. Keep going.',
    tone: 'neutral'
  }
};

export default function Calibration() {
  const { userId } = useAuth();
  const questions = useLiveQuery(
    async () => (userId ? db.questions.where('user_id').equals(userId).toArray() : []),
    [userId],
    []
  );

  const rows = useMemo(() => calibrationBySubject(questions), [questions]);
  const overall = useMemo(() => calibrationOverall(rows), [rows]);

  // Missing-decision inbox: questions with an outcome but no mark_decision yet.
  const missing = useMemo(
    () =>
      questions
        .filter((q) => q.mark_decision === null)
        .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
        .slice(0, 25),
    [questions]
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Calibration"
        description="How well your MARK/SKIP/50-50 calls hold up under −⅓ negative marking."
      />

      <Card>
        <CardHeader title="Overall this account" />
        <CardBody>
          {overall.decided === 0 && overall.skipped === 0 ? (
            <Empty
              title="Nothing to calibrate yet"
              hint="Tag a mark decision on a question after solving it. It takes a second per row."
              className="border-0 py-8"
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatCell label="Decided" value={overall.decided} />
              <StatCell label="Correct" value={overall.correct} color="text-success" />
              <StatCell label="Wrong" value={overall.wrong} color="text-danger" />
              <StatCell label="Skipped" value={overall.skipped} muted />
              <div className="flex flex-col gap-1 rounded border border-border bg-bg-overlay/40 px-3 py-2">
                <span className="u-label">Expected value / Q</span>
                <span
                  className={cn(
                    'u-num text-[20px] font-semibold leading-none',
                    overall.expectedValue > 0 ? 'text-success' : overall.expectedValue < 0 ? 'text-danger' : 'text-text-faint'
                  )}
                >
                  {fmtEV(overall.expectedValue)}
                </span>
                <span className="text-[11px] text-text-faint">MARK accuracy {fmtPct(overall.accuracy)}</span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Per subject" />
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <p className="p-4 text-[13px] text-text-faint">
              Nothing tagged yet. Set a decision on any question via the inbox below.
            </p>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-text-muted">
                  <th className="px-4 py-2 font-mono">Subject</th>
                  <th className="px-2 py-2 text-right font-mono">MARK</th>
                  <th className="px-2 py-2 text-right font-mono">50-50</th>
                  <th className="px-2 py-2 text-right font-mono">SKIP</th>
                  <th className="px-2 py-2 text-right font-mono">Accuracy</th>
                  <th className="px-2 py-2 text-right font-mono">EV / Q</th>
                  <th className="px-4 py-2 font-mono">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const rec = RECOMMENDATION_COPY[r.recommendation];
                  const ink = subjectInk(r.subject);
                  return (
                    <tr key={r.subject}>
                      <td className="px-4 py-2">
                        <span className="flex items-center gap-2">
                          <span className={cn('h-1.5 w-1.5 rounded-full', ink.dot)} />
                          <span className="font-medium text-text">{r.subject}</span>
                        </span>
                      </td>
                      <td className="u-num px-2 py-2 text-right text-text-muted">
                        {r.markedCorrect}/{r.marked}
                      </td>
                      <td className="u-num px-2 py-2 text-right text-text-muted">
                        {r.fiftyFiftyCorrect}/{r.fiftyFifty}
                      </td>
                      <td className="u-num px-2 py-2 text-right text-text-muted">{r.skipped}</td>
                      <td className="u-num px-2 py-2 text-right">{fmtPct(r.accuracy)}</td>
                      <td
                        className={cn(
                          'u-num px-2 py-2 text-right font-semibold',
                          r.expectedValue > 0 ? 'text-success' : r.expectedValue < 0 ? 'text-danger' : 'text-text-faint'
                        )}
                      >
                        {fmtEV(r.expectedValue)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-[12px]',
                            rec.tone === 'warn' && 'text-warn',
                            rec.tone === 'success' && 'text-success',
                            rec.tone === 'neutral' && 'text-text-muted'
                          )}
                          title={rec.hint}
                        >
                          {rec.tone === 'warn' ? (
                            <AlertTriangle size={12} strokeWidth={2} />
                          ) : rec.tone === 'success' ? (
                            <Check size={12} strokeWidth={2} />
                          ) : (
                            <Info size={12} strokeWidth={2} />
                          )}
                          {rec.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Waiting on a decision"
          aside={
            missing.length > 0 && (
              <Badge tone="warn">
                {missing.length} {plural(missing.length, 'row')}
              </Badge>
            )
          }
        />
        <CardBody className="p-0">
          {missing.length === 0 ? (
            <p className="p-4 text-[13px] text-text-faint">
              Every logged question has a mark decision. Nothing to do here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {missing.map((q) => (
                <MissingRow key={q.id} q={q} />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-text-faint">
          <span className="u-label">EV math</span>
          <span>
            Skip = <span className="u-num">0</span>
          </span>
          <span>
            MARK correct = <span className="u-num">+1</span>
          </span>
          <span>
            MARK wrong = <span className="u-num">−⅓</span>
          </span>
          <span className="ml-auto">
            EV / Q averages over decisions taken (MARK + 50-50). Skips don't move the average.
          </span>
        </CardBody>
      </Card>
    </div>
  );
}

function StatCell({
  label,
  value,
  color,
  muted = false
}: {
  label: string;
  value: number;
  color?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded border border-border bg-bg-overlay/40 px-3 py-2">
      <span className="u-label">{label}</span>
      <span
        className={cn(
          'u-num text-[20px] font-semibold leading-none',
          value > 0 ? color ?? 'text-text' : muted ? 'text-text-faint' : 'text-text-faint'
        )}
      >
        {value}
      </span>
    </div>
  );
}

function MissingRow({ q }: { q: QuestionRow }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const spec = OUTCOME_BY_CODE[q.outcome];

  async function persist(update: Partial<Pick<QuestionRow, 'mark_decision' | 'mark_correct'>>) {
    setSaving(true);
    try {
      await writeLocal('questions', { ...q, ...update });
    } finally {
      setSaving(false);
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-bg-overlay/40"
      >
        <span className="u-num w-[74px] shrink-0 text-[11px] text-text-faint">
          {formatDate(q.created_at.slice(0, 10), 'dd MMM')}
        </span>
        <span className="flex w-[170px] shrink-0 items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full', subjectInk(q.subject).dot)} />
          <span className="truncate text-[12px] text-text-muted">{q.subject}</span>
        </span>
        <Badge tone={spec.tone === 'ok' ? 'success' : spec.tone === 'slow' ? 'warn' : spec.tone === 'guess' ? 'guess' : 'danger'}>
          {q.outcome}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {q.pattern_name ?? <span className="text-text-faint">no pattern</span>}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={cn('shrink-0 text-text-faint transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-bg-overlay/40 px-4 py-3">
          <span className="u-label">Decision</span>
          {MARK_DECISIONS.map((m) => (
            <Button
              key={m.value}
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => void persist({ mark_decision: m.value })}
            >
              {m.label}
            </Button>
          ))}
          <span className="u-label ml-6">Outcome</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => void persist({ mark_correct: true })}
          >
            <Check size={14} strokeWidth={2} className="mr-1 text-success" />
            Paid off
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => void persist({ mark_correct: false })}
          >
            <X size={14} strokeWidth={2} className="mr-1 text-danger" />
            Did not
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() =>
              void persist({ mark_decision: 'SKIP', mark_correct: null })
            }
          >
            <MinusCircle size={14} strokeWidth={2} className="mr-1 text-text-faint" />
            Skip
          </Button>
        </div>
      )}
    </li>
  );
}
