import { cn, clamp } from '@/lib/utils';

export function Progress({
  value,
  max = 100,
  tone = 'accent',
  className
}: {
  value: number;
  max?: number;
  tone?: 'accent' | 'success' | 'danger' | 'neutral';
  className?: string;
}) {
  const pct = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  const fill = {
    accent: 'bg-accent',
    success: 'bg-success',
    danger: 'bg-danger',
    neutral: 'bg-text-faint'
  }[tone];
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-[2px] w-full overflow-hidden bg-border', className)}
    >
      <div className={cn('h-full transition-all', fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
