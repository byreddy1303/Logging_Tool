// /planner — calendar-based study planner.
//
// Everything is local-first: DayPlans live in localStorage keyed by
// planner_YYYY-MM-DD. The old Supabase-backed plan_items table stays intact
// but is no longer surfaced here. See DECISIONS.md for the rationale.
//
// Structure:
//   - top card: month + WhatsApp/digest settings
//   - calendar grid (full-width) with click-to-open day modal
//   - modal edits persist immediately on every field change
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import PageHeader from '@/components/layout/PageHeader';
import Calendar from '@/components/planner/Calendar';
import DayPlanModal from '@/components/planner/DayPlanModal';
import WhatsAppSetup from '@/components/planner/WhatsAppSetup';
import { useUiStore } from '@/stores/ui';
import {
  deleteDayPlan,
  emptyDayPlan,
  loadDayPlan,
  loadPlanIndexForMonth,
  loadWhatsAppSettings,
  saveDayPlan,
  summarize,
  type DayCellSummary,
  type DayPlan,
  type WhatsAppSettings
} from '@/lib/planner-storage';
import {
  PLANNER_MIN_MONTH_INDEX,
  PLANNER_MIN_YEAR
} from '@/lib/planner-constants';
import {
  buildDigestMessage,
  sendWhatsApp,
  startDailyTicker
} from '@/lib/planner-notify';

function todayLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Planner() {
  const today = useMemo(() => new Date(), []);
  const pushToast = useUiStore((s) => s.pushToast);

  const initialY = Math.max(today.getFullYear(), PLANNER_MIN_YEAR);
  const initialM =
    today.getFullYear() === PLANNER_MIN_YEAR
      ? Math.max(today.getMonth(), PLANNER_MIN_MONTH_INDEX)
      : today.getMonth();

  const [year, setYear] = useState(initialY);
  const [monthIndex, setMonthIndex] = useState(initialM);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [openPlan, setOpenPlan] = useState<DayPlan | null>(null);
  const [waSettings, setWaSettings] = useState<WhatsAppSettings>(() =>
    loadWhatsAppSettings()
  );
  // bumping `revision` after saves/deletes forces the summary memo to refetch
  // localStorage without diving into React refs.
  const [revision, setRevision] = useState(0);

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

  // Start the daily digest ticker while a Planner tab is mounted.
  useEffect(() => {
    const stop = startDailyTicker();
    return stop;
  }, []);

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

  function openDate(iso: string) {
    const existing = loadDayPlan(iso);
    setSelectedDate(iso);
    setOpenPlan(existing ?? emptyDayPlan(iso));
  }

  function closeModal() {
    setSelectedDate(null);
    setOpenPlan(null);
  }

  function onChangePlan(next: DayPlan) {
    setOpenPlan(next);
    saveDayPlan(next);
    setRevision((n) => n + 1);
  }

  function onDeletePlan() {
    if (!selectedDate) return;
    deleteDayPlan(selectedDate);
    setRevision((n) => n + 1);
    closeModal();
    pushToast('Day plan cleared.', 'neutral');
  }

  async function onSendWhatsApp() {
    if (!selectedDate || !openPlan) return;
    const text = buildDigestMessage(openPlan, selectedDate);
    const res = await sendWhatsApp(waSettings, text);
    if (res.ok) {
      pushToast('Sent to WhatsApp.', 'success');
    } else {
      pushToast(
        res.error ?? `WhatsApp send failed (${res.status})`,
        'neutral'
      );
    }
  }

  const todayISO = todayLocalISO(today);

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

      <WhatsAppSetup settings={waSettings} onChange={setWaSettings} />

      <AnimatePresence>
        {selectedDate && openPlan && (
          <DayPlanModal
            date={selectedDate}
            plan={openPlan}
            onChange={onChangePlan}
            onClose={closeModal}
            onDelete={onDeletePlan}
            onSendWhatsApp={onSendWhatsApp}
            canSendWhatsApp={
              waSettings.phoneE164.length > 0 && waSettings.apiKey.length > 0
            }
          />
        )}
      </AnimatePresence>

      <p className="text-[11px] text-text-faint">
        Today: <span className="u-num text-text">{todayISO}</span>. Plans stored
        on this device only.
      </p>
    </div>
  );
}
