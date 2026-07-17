// Initial dashboard (S09, F1.2). Live counts come straight from Dexie;
// S17 replaces the placeholders with the full F3.4 analysis widgets.
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import PageHeader from '@/components/layout/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Empty } from '@/components/ui/Empty';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/db';
import { useAuth } from '@/hooks/useAuth';
import { cn, formatDate, todayISO, plural } from '@/lib/utils';
import { EXAM_DATE_DEFAULT } from '@/lib/constants';

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3">
      <span className="u-label">{label}</span>
      <span className={cn('u-num text-2xl leading-none', accent && value > 0 && 'text-accent')}>
        {value}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { userId, profile } = useAuth();
  const navigate = useNavigate();
  const today = todayISO();

  const dueToday =
    useLiveQuery(async () => {
      if (!userId) return 0;
      const rows = await db.reattempts.where('user_id').equals(userId).toArray();
      return rows.filter((r) => r.stage !== 'MASTERED' && r.scheduled_date <= today).length;
    }, [userId, today]) ?? 0;

  const surface =
    useLiveQuery(async () => {
      if (!userId) return 0;
      const rows = await db.reattempts.where('user_id').equals(userId).toArray();
      return rows.filter((r) => r.stage !== 'MASTERED').length;
    }, [userId]) ?? 0;

  const sessionCount =
    useLiveQuery(
      async () => (userId ? db.sessions.where('user_id').equals(userId).count() : 0),
      [userId]
    ) ?? 0;

  const lastSession = useLiveQuery(async () => {
    if (!userId) return undefined;
    const rows = await db.sessions.where('user_id').equals(userId).sortBy('created_at');
    return rows.at(-1);
  }, [userId]);

  const weeklyFix = useLiveQuery(async () => {
    if (!userId) return undefined;
    const rows = await db.weekly_reviews.where('user_id').equals(userId).sortBy('week_start');
    return rows.at(-1)?.this_weeks_fix ?? undefined;
  }, [userId]);

  const examDate = profile?.exam_date ?? EXAM_DATE_DEFAULT;
  const daysLeft = differenceInCalendarDays(parseISO(examDate), new Date());

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Dashboard"
        description={`${formatDate(today, 'EEE dd MMM')} · T−${daysLeft}d to GATE`}
        actions={
          <Button variant="primary" onClick={() => navigate('/session/new')}>
            New session
          </Button>
        }
      />

      <Card>
        <div className="grid grid-cols-3 divide-x divide-border">
          <Stat label="Due today" value={dueToday} accent />
          <Stat label="Mistake surface" value={surface} />
          <Stat label="Sessions logged" value={sessionCount} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Re-attempts due"
          aside={
            dueToday > 0 && (
              <Button size="sm" onClick={() => navigate('/reattempts')}>
                Start review
              </Button>
            )
          }
        />
        <CardBody>
          {dueToday > 0 ? (
            <p className="text-[13px] text-text-muted">
              <span className="u-num text-text">{dueToday}</span>{' '}
              {plural(dueToday, 'question')} scheduled for re-attempt today.
            </p>
          ) : (
            <p className="text-[13px] text-text-faint">Nothing due. The queue fills as you tag mistakes.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="This week's fix" />
        <CardBody>
          {weeklyFix ? (
            <p className="text-[15px] leading-relaxed">{weeklyFix}</p>
          ) : (
            <p className="text-[13px] text-text-faint">
              No weekly review yet. Your ONE fix for the week appears here after your first review.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Last session" />
        <CardBody>
          {lastSession ? (
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-sm">{lastSession.subject}</p>
                <p className="mt-0.5 text-[12px] text-text-faint">
                  {formatDate(lastSession.date)} · target{' '}
                  <span className="u-num">{lastSession.target_duration_min}</span> min
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate('/journal')}>
                Journal
              </Button>
            </div>
          ) : (
            <Empty
              title="No sessions yet"
              hint="Start a timed session, tag every question, and this page starts earning its keep."
              action={
                <Button onClick={() => navigate('/session/new')}>Start first session</Button>
              }
              className="border-0 py-8"
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
