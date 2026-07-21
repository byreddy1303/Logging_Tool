// Large full-width monthly calendar. Full desktop grid, collapses to a
// scrolling stack on mobile.
//
// Constraints from the spec:
//   - starts July 2025; prev arrow disabled at that boundary.
//   - each cell is a large clickable area (min 92px desktop, 72px mobile)
//   - today is highlighted; days with plans show subject chips + total time
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PLANNER_MIN_MONTH_INDEX,
  PLANNER_MIN_YEAR,
  subjectChipInk
} from '@/lib/planner-constants';
import type { DayCellSummary } from '@/lib/planner-storage';

interface Props {
  year: number;
  monthIndex: number; // 0-11
  today: Date;
  planIndex: Set<string>;
  summaries: Map<string, DayCellSummary>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPickDate: (isoDate: string) => void;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function Calendar({
  year,
  monthIndex,
  today,
  planIndex,
  summaries,
  onPrevMonth,
  onNextMonth,
  onPickDate
}: Props) {
  const atMin = year === PLANNER_MIN_YEAR && monthIndex === PLANNER_MIN_MONTH_INDEX;

  const cells = useMemo(() => {
    const first = new Date(year, monthIndex, 1);
    const startWeekday = first.getDay(); // 0=Sun
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const daysInPrev = new Date(year, monthIndex, 0).getDate();

    const arr: {
      d: number;
      inMonth: boolean;
      iso: string;
    }[] = [];
    // leading blanks pulled from prev month for grid alignment
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = daysInPrev - i;
      const prevM = monthIndex === 0 ? 11 : monthIndex - 1;
      const prevY = monthIndex === 0 ? year - 1 : year;
      arr.push({ d, inMonth: false, iso: iso(prevY, prevM, d) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ d, inMonth: true, iso: iso(year, monthIndex, d) });
    }
    // trailing to complete 6 weeks (42 cells) so height is stable
    while (arr.length < 42) {
      const d = arr.length - startWeekday - daysInMonth + 1;
      const nextM = monthIndex === 11 ? 0 : monthIndex + 1;
      const nextY = monthIndex === 11 ? year + 1 : year;
      arr.push({ d, inMonth: false, iso: iso(nextY, nextM, d) });
    }
    return arr;
  }, [year, monthIndex]);

  const todayISO = iso(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="flex flex-col rounded-lg border border-border bg-bg-raised">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onPrevMonth}
          disabled={atMin}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-raised text-text-muted transition-all hover:border-border-hover hover:text-text',
            atMin && 'cursor-not-allowed opacity-40 hover:border-border hover:text-text-muted'
          )}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <div className="flex items-baseline gap-2">
          <h2 className="font-display text-[18px] font-bold text-text">
            {MONTH_NAMES[monthIndex]}
          </h2>
          <span className="u-num text-[13px] text-text-muted">{year}</span>
        </div>
        <button
          type="button"
          onClick={onNextMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-bg-raised text-text-muted transition-all hover:border-border-hover hover:text-text"
          aria-label="Next month"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-border bg-bg-overlay/50">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="px-2 py-1.5 text-center text-[10.5px] font-semibold uppercase tracking-wider text-text-muted"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          const isToday = c.inMonth && c.iso === todayISO;
          const hasPlan = c.inMonth && planIndex.has(c.iso);
          const summary = summaries.get(c.iso);
          const isWeekend = i % 7 === 0 || i % 7 === 6;
          return (
            <button
              key={`${c.iso}-${i}`}
              type="button"
              onClick={() => c.inMonth && onPickDate(c.iso)}
              disabled={!c.inMonth}
              className={cn(
                'group relative flex min-h-[72px] flex-col items-stretch gap-1 border-b border-r border-border px-1.5 py-1.5 text-left transition-colors sm:min-h-[92px] sm:px-2 sm:py-2',
                (i + 1) % 7 === 0 && 'border-r-0',
                i >= 35 && 'border-b-0',
                !c.inMonth && 'bg-bg-overlay/30 text-text-faint',
                c.inMonth && !isToday && 'hover:bg-accent-faint/30',
                c.inMonth && isWeekend && !isToday && 'bg-bg-overlay/20',
                isToday && 'bg-accent-faint/60 ring-1 ring-inset ring-accent'
              )}
            >
              <div className="flex items-start justify-between">
                <span
                  className={cn(
                    'font-display text-[13px] font-semibold',
                    isToday ? 'text-accent' : c.inMonth ? 'text-text' : 'text-text-faint'
                  )}
                >
                  {c.d}
                </span>
                {hasPlan && summary && summary.totalMin > 0 && (
                  <span className="u-num rounded-full bg-accent/12 px-1.5 py-0.5 text-[9.5px] font-semibold text-accent">
                    {formatMin(summary.totalMin)}
                  </span>
                )}
                {hasPlan && (!summary || summary.totalMin === 0) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                )}
              </div>
              {hasPlan && summary && summary.subjects.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {summary.subjects.slice(0, 3).map((s) => {
                    const ink = subjectChipInk(s);
                    return (
                      <span
                        key={s}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9.5px] font-medium leading-tight',
                          ink.bg,
                          ink.text
                        )}
                      >
                        {shortSubject(s)}
                      </span>
                    );
                  })}
                  {summary.subjects.length > 3 && (
                    <span className="rounded bg-bg-overlay px-1.5 py-0.5 text-[9.5px] text-text-muted">
                      +{summary.subjects.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function shortSubject(s: string): string {
  // 8 chars max fits a calendar chip on desktop. Weekly/PYQ etc already short.
  if (s.length <= 10) return s;
  return `${s.slice(0, 9)}…`;
}

function formatMin(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}
