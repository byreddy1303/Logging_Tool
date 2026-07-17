import { NavLink, useLocation } from 'react-router-dom';
import { Gauge, Play, NotebookText, Shapes, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Route prefixes that light this tab up. */
  match: string[];
}

const TABS: Tab[] = [
  { to: '/', label: 'Home', icon: Gauge, match: ['/'] },
  { to: '/session/new', label: 'Session', icon: Play, match: ['/session'] },
  { to: '/journal', label: 'Journal', icon: NotebookText, match: ['/journal'] },
  {
    to: '/patterns',
    label: 'Analysis',
    icon: Shapes,
    match: ['/patterns', '/reattempts', '/weekly-review', '/heatmap', '/readiness', '/calibration']
  },
  {
    to: '/doubt',
    label: 'Learn',
    icon: MessageSquare,
    match: ['/doubt', '/triangulate', '/trigger-drill', '/formulas']
  }
];

export default function MobileTabs() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Primary"
    >
      {TABS.map((tab) => {
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
              'relative flex h-12 flex-col items-center justify-center gap-0.5 transition-colors',
              active ? 'text-text' : 'text-text-faint'
            )}
          >
            {active && <span className="absolute inset-x-4 top-0 h-[2px] bg-accent" />}
            <Icon size={18} strokeWidth={1.5} />
            <span className="font-mono text-[9px] uppercase tracking-[0.1em]">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
