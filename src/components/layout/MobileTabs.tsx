import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  Gauge,
  Menu,
  NotebookText,
  PenLine,
  Play,
  Settings,
  Shapes,
  Sigma,
  Users,
  X,
  Zap
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { cn } from '@/lib/utils';
import { db } from '@/lib/db';
import { useSessionStore } from '@/stores/session';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Route prefixes that light this tab up. */
  match: string[];
  active: string;
  bar: string;
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: Gauge, match: ['/'], active: 'text-accent', bar: 'bg-accent' },
  {
    to: '/log',
    label: 'Log',
    icon: PenLine,
    match: ['/log'],
    active: 'text-ink-rose',
    bar: 'bg-ink-rose'
  },
  {
    to: '/session/new',
    label: 'Session',
    icon: Play,
    match: ['/session'],
    active: 'text-ink-teal',
    bar: 'bg-ink-teal'
  },
  {
    to: '/journal',
    label: 'Journal',
    icon: NotebookText,
    match: ['/journal'],
    active: 'text-ink-cobalt',
    bar: 'bg-ink-cobalt'
  },
  {
    to: '/patterns',
    label: 'Analysis',
    icon: Shapes,
    match: ['/patterns', '/reattempts', '/weekly-review', '/heatmap', '/readiness', '/calibration'],
    active: 'text-ink-violet',
    bar: 'bg-ink-violet'
  }
];

export default function MobileTabs() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const storedSessionId = useSessionStore((s) => s.sessionId);
  const liveSessionId = useLiveQuery(async () => {
    if (!storedSessionId) return null;
    const row = await db.sessions.get(storedSessionId);
    return row && row.actual_duration_min === null ? storedSessionId : null;
  }, [storedSessionId]);
  const tabs = TABS.map((t) =>
    t.label === 'Session' && liveSessionId
      ? { ...t, to: `/session/${liveSessionId}/solve`, label: 'Resume' }
      : t
  );
  const moreRoutes = ['/planner', '/buddy', '/trigger-drill', '/formulas', '/settings'];
  const moreActive = moreRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-text/20 backdrop-blur-[1px]"
            aria-label="Close more navigation"
            onClick={() => setMoreOpen(false)}
          />
          <section
            className="absolute inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] rounded-lg border border-border bg-bg-raised p-3 shadow-xl"
            aria-label="More destinations"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="u-label">More</p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="rounded p-1.5 text-text-faint hover:bg-bg-overlay hover:text-text"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: '/planner', label: 'Planner', icon: CalendarDays },
                { to: '/buddy', label: 'Buddy', icon: Users },
                { to: '/trigger-drill', label: 'Trigger drill', icon: Zap },
                { to: '/formulas', label: 'Formulas', icon: Sigma },
                { to: '/settings', label: 'Settings', icon: Settings }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-12 items-center gap-2.5 rounded border px-3 text-[13px] font-semibold',
                        isActive
                          ? 'border-accent/30 bg-accent-faint text-accent'
                          : 'border-border/70 bg-bg text-text-muted'
                      )
                    }
                  >
                    <Icon size={17} strokeWidth={1.75} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-6 border-t border-border bg-bg-raised/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(36,30,53,0.06)] backdrop-blur md:hidden"
        aria-label="Primary"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active =
            tab.to === '/'
              ? pathname === '/'
              : tab.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={cn(
                'relative flex h-14 flex-col items-center justify-center gap-1 transition-colors active:scale-95',
                active ? tab.active : 'text-text-faint'
              )}
            >
              {active && <span className={cn('absolute inset-x-4 top-0 h-[3px] rounded-b-full', tab.bar)} />}
              <Icon size={19} strokeWidth={1.75} />
              <span className="text-[9px] font-semibold">{tab.label}</span>
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          className={cn(
            'relative flex h-14 flex-col items-center justify-center gap-1 transition-colors active:scale-95',
            moreOpen || moreActive ? 'text-ink-rose' : 'text-text-faint'
          )}
        >
          {(moreOpen || moreActive) && (
            <span className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-ink-rose" />
          )}
          <Menu size={19} strokeWidth={1.75} />
          <span className="text-[9px] font-semibold">More</span>
        </button>
      </nav>
    </>
  );
}
