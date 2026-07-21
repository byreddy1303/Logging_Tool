import { useMemo, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { formatDate, todayISO } from '@/lib/utils';
import { pickOneLinerFor } from '@/lib/one_liners';
import { BrandMark } from '@/components/shared/Brand';

function greeting(hour: number, firstName: string): string {
  const who = firstName.trim() || 'friend';
  if (hour < 5) return `Late night, ${who}.`;
  if (hour < 12) return `Good morning, ${who}.`;
  if (hour < 17) return `Good afternoon, ${who}.`;
  if (hour < 21) return `Good evening, ${who}.`;
  return `Late night, ${who}.`;
}

export interface HeroCardProps {
  name: string | null | undefined;
  userId: string | null;
  showCountdown: boolean;
  daysLeft: number;
  action?: ReactNode;
}

export default function HeroCard({ name, userId, showCountdown, daysLeft, action }: HeroCardProps) {
  const today = todayISO();
  const firstName = (name ?? '').split(/\s+/)[0] ?? '';
  const heading = greeting(new Date().getHours(), firstName);
  const line = useMemo(() => pickOneLinerFor(today, userId ?? ''), [today, userId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="u-panel relative overflow-hidden"
    >
      <div className="u-margin-line px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-text sm:text-[30px]">
              {heading}
            </h1>
            <p className="mt-1 text-[12.5px] text-text-muted">
              {formatDate(today, 'EEEE, dd MMM')}
              {showCountdown && (
                <>
                  {' · '}
                  <span className="u-num">T−{daysLeft}d</span> to GATE
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <BrandMark className="h-10 w-10 md:hidden" />
            <span className="u-stamp hidden md:inline">rank notebook</span>
          </div>
        </div>

        <div className="u-rule my-4" />

        <div className="flex items-start gap-3">
          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
          <p className="font-display text-[15px] leading-relaxed text-text sm:text-[16px]">
            <span className="u-highlight">{line.text}</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
