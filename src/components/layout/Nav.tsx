import { NavLink } from 'react-router-dom';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import {
  Gauge,
  Play,
  NotebookText,
  Shapes,
  RotateCcw,
  CalendarCheck,
  Grid3x3,
  MessageSquare,
  Columns3,
  Zap,
  Sigma,
  Users,
  Settings,
  LogOut
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { useAuth } from '@/hooks/useAuth';
import { EXAM_DATE_DEFAULT } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
}

const MAIN: Item[] = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/session/new', label: 'Session', icon: Play },
  { to: '/journal', label: 'Journal', icon: NotebookText }
];

const ANALYSIS: Item[] = [
  { to: '/patterns', label: 'Patterns', icon: Shapes },
  { to: '/reattempts', label: 'Re-attempts', icon: RotateCcw },
  { to: '/weekly-review', label: 'Weekly', icon: CalendarCheck },
  { to: '/heatmap', label: 'Heatmap', icon: Grid3x3 }
];

const LEARN: Item[] = [
  { to: '/doubt', label: 'Doubt', icon: MessageSquare },
  { to: '/triangulate', label: 'Triangulate', icon: Columns3 },
  { to: '/trigger-drill', label: 'Trigger drill', icon: Zap },
  { to: '/formulas', label: 'Formulas', icon: Sigma }
];

const SOCIAL: Item[] = [
  { to: '/buddy', label: 'Buddy', icon: Users },
  { to: '/settings', label: 'Settings', icon: Settings }
];

function NavItem({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        cn(
          'relative flex h-8 items-center gap-3 rounded-sm px-3 text-[13px] transition-colors',
          isActive
            ? 'bg-bg-overlay text-text before:absolute before:left-0 before:top-1.5 before:h-5 before:w-[2px] before:bg-accent'
            : 'text-text-muted hover:bg-bg-overlay hover:text-text'
        )
      }
    >
      <Icon size={16} strokeWidth={1.5} className="shrink-0" />
      {item.label}
    </NavLink>
  );
}

function Group({ label, items }: { label?: string; items: Item[] }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <p className="u-label px-3 pb-1 pt-4">{label}</p>}
      {items.map((i) => (
        <NavItem key={i.to} item={i} />
      ))}
    </div>
  );
}

export default function Nav() {
  const { profile, sandbox } = useAuth();
  const signOut = useAuthStore((s) => s.signOut);
  const daysLeft = differenceInCalendarDays(
    parseISO(profile?.exam_date ?? EXAM_DATE_DEFAULT),
    new Date()
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-border bg-bg md:flex">
      <div className="flex items-baseline justify-between px-4 pb-4 pt-5">
        <span className="font-mono text-[15px] font-medium tracking-[0.04em]">
          AIR<span className="text-accent">_</span>
        </span>
        <span className="u-num text-xs text-text-muted">
          T−{daysLeft}
          <span className="text-text-faint">d</span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
        <Group items={MAIN} />
        <Group label="Analysis" items={ANALYSIS} />
        <Group label="Learn" items={LEARN} />
        <Group label="" items={SOCIAL} />
      </nav>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs text-text-muted">{profile?.name ?? '—'}</p>
            <p className="u-num truncate text-[11px] text-text-faint">
              {sandbox ? 'local sandbox' : (profile?.email ?? '')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="shrink-0 text-text-faint transition-colors hover:text-danger"
          >
            <LogOut size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </aside>
  );
}
