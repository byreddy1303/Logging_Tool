import { NavLink, useLocation } from 'react-router-dom';
import { Gauge, Play, NotebookText, Shapes, MessageSquare } from 'lucide-react';
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
  },
  {
    to: '/doubt',
    label: 'Learn',
    icon: MessageSquare,
    match: ['/doubt', '/triangulate', '/trigger-drill', '/formulas'],
    active: 'text-ink-marigold',
    bar: 'bg-ink-marigold'
  }
];

export default function MobileTabs() {
  const { pathname } = useLocation();
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

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg-raised/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(36,30,53,0.06)] backdrop-blur md:hidden"
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
            {active && <span className={cn('absolute inset-x-5 top-0 h-[3px] rounded-b-full', tab.bar)} />}
            <Icon size={20} strokeWidth={1.75} />
            <span className="text-[10px] font-semibold">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
