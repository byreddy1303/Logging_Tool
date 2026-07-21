// Cross-day rollups from every DayPlan in localStorage. Purely local — no
// server round-trip. Refreshes whenever `revision` (a number driven by
// upstream saves) changes.
import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PLANNER_SUBJECTS } from '@/lib/planner-constants';
import {
  loadAllDayPlans,
  modeShare,
  neglectedSubjects,
  priorityShare,
  reviewStats,
  rollup,
  subjectShare,
  windowed,
  type Share
} from '@/lib/planner-insights';
import { cn } from '@/lib/utils';

interface Props {
  /** Bumped by the caller after saves/deletes so the memo recomputes. */
  revision: number;
}

function formatHours(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

export default function PlannerInsights({ revision }: Props) {
  const {
    plans,
    plans30,
    r30,
    subj30,
    mode30,
    prio30,
    review30,
    neglect30
  } = useMemo(() => {
    void revision;
    const plans = loadAllDayPlans();
    const plans30 = windowed(plans, 30);
    return {
      plans,
      plans30,
      r30: rollup(plans30),
      subj30: subjectShare(plans30),
      mode30: modeShare(plans30),
      prio30: priorityShare(plans30),
      review30: reviewStats(plans30),
      neglect30: neglectedSubjects(plans30, PLANNER_SUBJECTS, 30, 60)
    };
  }, [revision]);

  if (plans.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        title="Planner insights"
        aside={
          <span className="inline-flex items-center gap-1 text-[11px] text-text-faint">
            <Sparkles size={11} strokeWidth={1.75} /> last 30 days · on-device
          </span>
        }
      />
      <CardBody className="flex flex-col gap-4">
        {plans30.length === 0 ? (
          <p className="text-[12.5px] text-text-muted">
            No plans in the last 30 days. Your all-time count is{' '}
            <span className="u-num text-text">{plans.length}</span> — pick a date
            in the calendar to start.
          </p>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Kpi label="Days planned" value={String(r30.daysPlanned)} />
              <Kpi
                label="Total planned"
                value={formatHours(r30.totalMinPlanned)}
              />
              <Kpi
                label="Avg sessions/day"
                value={String(r30.avgSessionsPerDay)}
                hint={`Avg length ${r30.avgSessionDurationMin}m`}
              />
              <Kpi
                label="Avg completion"
                value={
                  review30.reviewedDays > 0
                    ? `${review30.avgCompletionPct}%`
                    : '—'
                }
                hint={`${review30.reviewedDays} days reviewed`}
              />
            </div>

            {/* Subject share */}
            <ShareBlock title="Subject share (by minutes)" shares={subj30.slice(0, 8)} />

            {/* Mode share */}
            <ShareBlock title="Study mode split" shares={mode30} />

            {/* Priority share */}
            <ShareBlock title="Priority mix" shares={prio30} />

            {/* Replicate rate */}
            {review30.reviewedDays > 0 && (
              <div className="rounded border border-border bg-bg-overlay/40 p-3">
                <p className="u-label mb-1.5">Would you replicate the plan?</p>
                <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-text">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Yes:{' '}
                    <span className="u-num font-semibold">
                      {review30.replicateYes}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-warn" /> Partial:{' '}
                    <span className="u-num font-semibold">
                      {review30.replicatePartial}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-danger" /> No:{' '}
                    <span className="u-num font-semibold">
                      {review30.replicateNo}
                    </span>
                  </span>
                </div>
              </div>
            )}

            {/* Neglected subjects */}
            {neglect30.length > 0 && (
              <div className="rounded border border-warn/40 bg-warn/5 p-3">
                <p className="u-label mb-1 text-warn">Neglected in last 30 days</p>
                <p className="text-[12.5px] text-text-muted">
                  These GATE-CS subjects got &lt; 60 min of planned time.
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {neglect30.slice(0, 8).map((s) => (
                    <li
                      key={s.label}
                      className="rounded-full border border-border bg-bg-raised px-2.5 py-0.5 text-[11.5px] text-text"
                    >
                      {s.label}
                      <span className="ml-1 u-num text-text-faint">
                        {s.min}m
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function Kpi({
  label,
  value,
  hint
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded border border-border bg-bg-overlay/40 px-3 py-2">
      <p className="u-label">{label}</p>
      <p className="u-num mt-0.5 text-[20px] font-semibold text-text">{value}</p>
      {hint && <p className="text-[10.5px] text-text-faint">{hint}</p>}
    </div>
  );
}

function ShareBlock({
  title,
  shares,
  unit = 'min'
}: {
  title: string;
  shares: Share[];
  unit?: 'min' | 'days';
}) {
  if (shares.length === 0) return null;
  const max = shares[0].min;
  return (
    <div>
      <p className="u-label mb-1.5">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {shares.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="w-40 truncate text-text">{s.label}</span>
            <div className="relative h-4 flex-1 overflow-hidden rounded bg-bg-overlay">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded',
                  'bg-accent'
                )}
                style={{ width: `${Math.max(2, Math.round((s.min / max) * 100))}%` }}
              />
            </div>
            <span className="u-num w-24 text-right text-text-muted">
              {unit === 'min' ? formatHours(s.min) : `${s.min} d`} ·{' '}
              {s.pct}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
