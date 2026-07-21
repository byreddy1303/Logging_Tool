// /planner — calendar-based study planner.
//
// Everything is local-first: DayPlans live in user-scoped localStorage.
// Study sessions are mirrored to the signed-in user's Supabase row so the
// opt-in Telegram digest can read that day's plan.
//
// Structure:
//   - calendar grid (full-width) with click-to-open day modal
//   - planner insights derived from saved study sessions
//   - modal edits persist immediately on every field change
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import PageHeader from '@/components/layout/PageHeader';
import Calendar from '@/components/planner/Calendar';
import DayPlanModal from '@/components/planner/DayPlanModal';
import PlannerInsights from '@/components/planner/PlannerInsights';
import {
  deleteCloudDayPlan,
  loadCloudDayPlan,
  saveCloudDayPlan,
  type CloudDayPlan
} from '@/lib/planner-cloud';
import { useUiStore } from '@/stores/ui';
import { useAuthStore } from '@/stores/auth';
import {
  cacheDayPlan,
  deleteDayPlan,
  emptyDayPlan,
  loadDayPlan,
  loadPlanIndexForMonth,
  saveDayPlan,
  summarize,
  type DayCellSummary,
  type DayPlan
} from '@/lib/planner-storage';
import {
  PLANNER_MIN_MONTH_INDEX,
  PLANNER_MIN_YEAR
} from '@/lib/planner-constants';
import { loadAllDayPlans } from '@/lib/planner-insights';

function todayLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function persistCloudPlan(userId: string, plan: CloudDayPlan): Promise<string | null> {
  if (plan.sessions.length === 0) return deleteCloudDayPlan(userId, plan.date);
  return saveCloudDayPlan(userId, plan);
}

export default function Planner() {
  const today = useMemo(() => new Date(), []);
  const todayISO = todayLocalISO(today);
  const pushToast = useUiStore((s) => s.pushToast);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const sandbox = useAuthStore((s) => s.sandbox);

  const initialY = Math.max(today.getFullYear(), PLANNER_MIN_YEAR);
  const initialM =
    today.getFullYear() === PLANNER_MIN_YEAR
      ? Math.max(today.getMonth(), PLANNER_MIN_MONTH_INDEX)
      : today.getMonth();

  const [year, setYear] = useState(initialY);
  const [monthIndex, setMonthIndex] = useState(initialM);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [openPlan, setOpenPlan] = useState<DayPlan | null>(null);
  // bumping `revision` after saves/deletes forces the summary memo to refetch
  // localStorage without diving into React refs.
  const [revision, setRevision] = useState(0);
  const syncTimerRef = useRef<number | null>(null);
  const pendingCloudPlanRef = useRef<CloudDayPlan | null>(null);
  const syncErrorShownRef = useRef(false);
  const cloudLoadTokenRef = useRef(0);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
      const pending = pendingCloudPlanRef.current;
      if (pending && userId && !sandbox) void persistCloudPlan(userId, pending);
    };
  }, [sandbox, userId]);

  useEffect(() => {
    if (!userId || sandbox) return;
    let active = true;
    const upcoming = loadAllDayPlans()
      .filter((plan) => plan.date >= todayISO && plan.sessions.length > 0)
      .slice(0, 45);

    void Promise.all(
      upcoming.map(async (local) => {
        const { plan: remote, error } = await loadCloudDayPlan(userId, local.date);
        if (error) return false;
        const localUpdated = Date.parse(local.updatedAt);
        const remoteUpdated = remote ? Date.parse(remote.updatedAt) : 0;
        if (!remote || localUpdated >= remoteUpdated) {
          await saveCloudDayPlan(userId, {
            date: local.date,
            sessions: local.sessions,
            updatedAt: local.updatedAt
          });
          return false;
        }
        cacheDayPlan({
          ...local,
          sessions: remote.sessions,
          updatedAt: remote.updatedAt
        });
        return true;
      })
    ).then((changed) => {
      if (active && changed.some(Boolean)) setRevision((value) => value + 1);
    });

    return () => {
      active = false;
    };
  }, [sandbox, todayISO, userId]);

  const { planIndex, summaries } = useMemo(() => {
    void revision;
    const idx = loadPlanIndexForMonth(year, monthIndex);
    const map = new Map<string, DayCellSummary>();
    idx.forEach((d) => {
      const plan = loadDayPlan(d);
      map.set(d, summarize(plan));
    });
    return { planIndex: idx, summaries: map };
  }, [year, monthIndex, revision]);

  const goPrev = useCallback(() => {
    setMonthIndex((m) => {
      if (year === PLANNER_MIN_YEAR && m === PLANNER_MIN_MONTH_INDEX) return m;
      if (m === 0) {
        setYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, [year]);

  const goNext = useCallback(() => {
    setMonthIndex((m) => {
      if (m === 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  function queuePlanSync(plan: DayPlan) {
    if (!userId || sandbox) return;
    const previous = pendingCloudPlanRef.current;
    if (previous && previous.date !== plan.date) {
      void persistCloudPlan(userId, previous);
    }
    pendingCloudPlanRef.current = {
      date: plan.date,
      sessions: plan.sessions,
      updatedAt: plan.updatedAt
    };
    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(async () => {
      syncTimerRef.current = null;
      const pending = pendingCloudPlanRef.current;
      pendingCloudPlanRef.current = null;
      if (!pending) return;
      const error = await persistCloudPlan(userId, pending);
      if (error && !syncErrorShownRef.current) {
        syncErrorShownRef.current = true;
        pushToast('Plan saved on this device, but Telegram sync is offline.', 'neutral');
      } else if (!error) {
        syncErrorShownRef.current = false;
      }
    }, 400);
  }

  function openDate(iso: string) {
    const existing = loadDayPlan(iso);
    const loadToken = ++cloudLoadTokenRef.current;
    setSelectedDate(iso);
    setOpenPlan(existing ?? emptyDayPlan(iso));

    if (!userId || sandbox) return;
    void loadCloudDayPlan(userId, iso).then(({ plan: remote, error }) => {
      if (loadToken !== cloudLoadTokenRef.current) return;
      if (error) return;
      const latestLocal = loadDayPlan(iso);
      if (!remote) {
        if (latestLocal) queuePlanSync(latestLocal);
        return;
      }

      const localUpdated = latestLocal ? Date.parse(latestLocal.updatedAt) : 0;
      const remoteUpdated = Date.parse(remote.updatedAt);
      if (latestLocal && localUpdated >= remoteUpdated) {
        queuePlanSync(latestLocal);
        return;
      }

      const hydrated: DayPlan = {
        ...(latestLocal ?? emptyDayPlan(iso)),
        sessions: remote.sessions,
        updatedAt: remote.updatedAt
      };
      cacheDayPlan(hydrated);
      setOpenPlan((current) => (current?.date === iso ? hydrated : current));
      setRevision((value) => value + 1);
    });
  }

  function closeModal() {
    cloudLoadTokenRef.current += 1;
    setSelectedDate(null);
    setOpenPlan(null);
  }

  function onChangePlan(next: DayPlan) {
    const saved = saveDayPlan(next);
    setOpenPlan(saved);
    queuePlanSync(saved);
    setRevision((n) => n + 1);
  }

  function onDeletePlan() {
    if (!selectedDate) return;
    cloudLoadTokenRef.current += 1;
    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = null;
    pendingCloudPlanRef.current = null;
    deleteDayPlan(selectedDate);
    if (userId && !sandbox) {
      void deleteCloudDayPlan(userId, selectedDate).then((error) => {
        if (error) pushToast('Local plan cleared; Telegram sync will retry later.', 'neutral');
      });
    }
    setRevision((n) => n + 1);
    closeModal();
    pushToast('Day plan cleared.', 'neutral');
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Planner"
        description="Plan a day. Review a day. Every field saves as you edit."
      />

      <Calendar
        year={year}
        monthIndex={monthIndex}
        today={today}
        planIndex={planIndex}
        summaries={summaries}
        onPrevMonth={goPrev}
        onNextMonth={goNext}
        onPickDate={openDate}
      />

      <PlannerInsights revision={revision} />

      <AnimatePresence>
        {selectedDate && openPlan && (
          <DayPlanModal
            date={selectedDate}
            plan={openPlan}
            onChange={onChangePlan}
            onClose={closeModal}
            onDelete={onDeletePlan}
          />
        )}
      </AnimatePresence>

      <p className="text-[11px] text-text-faint">
        Today: <span className="u-num text-text">{todayISO}</span>.{' '}
        {sandbox
          ? 'Plans are stored on this device.'
          : 'Study sessions save locally and sync privately for Telegram.'}
      </p>
    </div>
  );
}
