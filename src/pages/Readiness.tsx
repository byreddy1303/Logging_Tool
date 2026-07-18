// F5.3 — exam-day readiness. Score + per-component breakdown against local
// Dexie data (no round trip). When compute-readiness edge fn runs on a schedule
// it will overwrite this with the server's canonical number, but the math is
// identical so client display stays truthy in the interim.
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { CircleAlert, TrendingUp } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { db } from '@/lib/db';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth';
import {
  computeReadiness,
  readinessComponents,
  type ReadinessComponentKey
} from '@/lib/readiness';
import { EXAM_DATE_DEFAULT } from '@/lib/constants';

const ACCENT_BY_KEY: Record<ReadinessComponentKey, string> = {
  coverage: 'bg-ink-cobalt/10 text-ink-cobalt',
  retention: 'bg-ink-teal/10 text-ink-teal',
  calibration: 'bg-ink-violet/10 text-ink-violet',
  surface: 'bg-ink-rose/10 text-ink-rose'
};

function scoreBand(score: number): { label: string; tone: string } {
  if (score >= 75) return { label: 'strong', tone: 'text-success' };
  if (score >= 55) return { label: 'building', tone: 'text-accent' };
  if (score >= 35) return { label: 'thin', tone: 'text-warn' };
  return { label: 'raw', tone: 'text-danger' };
}

function Gauge({ score }: { score: number }) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const capped = Math.max(0, Math.min(100, score));
  const dash = (capped / 100) * circumference;
  const band = scoreBand(score);
  return (
    <div className="relative flex flex-col items-center">
      <svg width="180" height="180" viewBox="0 0 180 180" className="overflow-visible">
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          className="stroke-bg-overlay"
          strokeWidth="12"
        />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          className="stroke-accent"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          transform="rotate(-90 90 90)"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="u-num text-[42px] font-bold text-text">{Math.round(score)}</span>
        <span className={`u-label ${band.tone}`}>{band.label}</span>
      </div>
    </div>
  );
}

export default function Readiness() {
  const { userId } = useAuth();
  const profile = useAuthStore((s) => s.profile);

  const questions = useLiveQuery(
    () => (userId ? db.questions.where('user_id').equals(userId).toArray() : []),
    [userId],
    []
  );
  const reattempts = useLiveQuery(
    () => (userId ? db.reattempts.where('user_id').equals(userId).toArray() : []),
    [userId],
    []
  );
  const patterns = useLiveQuery(
    () => (userId ? db.patterns.where('user_id').equals(userId).toArray() : []),
    [userId],
    []
  );

  const breakdown = useMemo(
    () => computeReadiness({ questions, reattempts, patterns }),
    [questions, reattempts, patterns]
  );

  const components = useMemo(() => readinessComponents(breakdown), [breakdown]);

  const daysLeft = differenceInCalendarDays(
    parseISO(profile?.exam_date ?? EXAM_DATE_DEFAULT),
    new Date()
  );

  const anyData = questions.length + reattempts.length + patterns.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Readiness"
        description="A single 0–100 rollup of coverage, retention, MARK calibration, and open mistake surface."
      />

      {!anyData ? (
        <Empty
          title="Nothing to score yet"
          hint="Log a session or a couple of questions and the number will pop. The math is deterministic — no ambient LLM opinions."
        />
      ) : (
        <>
          <Card>
            <CardBody className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[auto_1fr]">
              <Gauge score={breakdown.score} />
              <div className="flex flex-col gap-3">
                <div>
                  <p className="u-label">Composite</p>
                  <p className="mt-1 text-[13.5px] text-text-muted">
                    Weighted 30/25/25/20 across coverage / retention / calibration / surface. A
                    week without new mistakes swings this five points; a full paper of tagged
                    questions swings it more.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-[12px] text-text-muted">
                  <span className="flex items-center gap-1">
                    <TrendingUp size={12} strokeWidth={1.75} className="text-accent" />
                    T−<span className="u-num text-text">{Math.max(0, daysLeft)}</span> days
                  </span>
                  <span>
                    <span className="u-num text-text">{breakdown.counts.patterns}</span> patterns
                    encountered
                  </span>
                  <span>
                    <span className="u-num text-text">{breakdown.counts.openReattempts}</span>{' '}
                    open re-attempts
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Components"
              aside={<span className="text-[11px] text-text-faint">sums to composite</span>}
            />
            <div className="flex flex-col divide-y divide-border">
              {components.map((c) => {
                const pct = Math.round(c.value * 100);
                const contribPct = Math.round(c.contribution);
                return (
                  <div key={c.key} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${ACCENT_BY_KEY[c.key]}`}>
                          {c.key}
                        </span>
                        <span className="font-display text-[14px] font-semibold text-text">
                          {c.label}
                        </span>
                      </div>
                      <div className="u-num text-[12px] text-text-faint">
                        <span className="text-text">{pct}%</span> ·{' '}
                        <span className="text-text-muted">
                          contributes {contribPct} pts (of {Math.round(c.weight * 100)})
                        </span>
                      </div>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-bg-overlay">
                      <div
                        className={`h-2 rounded ${c.key === 'surface' ? 'bg-ink-rose' : c.key === 'retention' ? 'bg-ink-teal' : c.key === 'calibration' ? 'bg-ink-violet' : 'bg-ink-cobalt'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[12px] text-text-muted">{c.hint}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader title="What moves the needle" />
            <CardBody className="grid grid-cols-1 gap-3 text-[13px] text-text-muted sm:grid-cols-2">
              <Nudge
                intro="Coverage"
                body="Every new pattern name you introduce during tagging counts — it's not about typing 400 questions, it's about naming 400 distinct patterns."
              />
              <Nudge
                intro="Retention"
                body="Only fractions that reach D30 or MASTERED help. Failing a re-attempt resets to D3, so a fresh miss drops this score by up to 3 points."
              />
              <Nudge
                intro="Calibration"
                body="Marking only when you can defend it beats maximising marks. Any MARK-wrong you log recalibrates this in the wrong direction."
              />
              <Nudge
                intro="Mistake surface"
                body="Below-baseline is fine; growing indefinitely isn't. Solve on paper before hitting 'Solved clean' — the ladder only rewards honest resolutions."
              />
            </CardBody>
          </Card>
        </>
      )}

      {breakdown.score < 40 && anyData && (
        <div className="flex items-start gap-2 rounded border border-warn/60 bg-warn/5 px-3 py-2 text-[12.5px] text-text">
          <CircleAlert size={14} className="mt-0.5 shrink-0 text-warn" strokeWidth={1.75} />
          <p>
            Below 40 is not a verdict — it usually means the tagging surface is still thin. Log
            more, and the number will move. Don't grade yourself yet.
          </p>
        </div>
      )}
    </div>
  );
}

function Nudge({ intro, body }: { intro: string; body: string }) {
  return (
    <div className="rounded border border-border/70 bg-bg-overlay/30 px-3 py-3">
      <p className="font-display text-[13px] font-semibold text-text">{intro}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-text-muted">{body}</p>
    </div>
  );
}
