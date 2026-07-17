import { cn, secondsToClock, clamp } from '@/lib/utils';

/** Big count-up clock with a hairline progress bar against the target time. */
export default function Timer({
  seconds,
  targetSec,
  className
}: {
  seconds: number;
  targetSec?: number;
  className?: string;
}) {
  const over = targetSec !== undefined && seconds > targetSec;
  const farOver = targetSec !== undefined && seconds > targetSec * 2;
  const pct = targetSec ? clamp((seconds / targetSec) * 100, 0, 100) : 0;
  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <span
        className={cn(
          'u-num text-[56px] leading-none tracking-tight md:text-[72px]',
          farOver ? 'text-danger' : over ? 'text-warn' : 'text-text'
        )}
      >
        {secondsToClock(seconds)}
      </span>
      {targetSec !== undefined && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-0.5 w-44 overflow-hidden rounded-full bg-bg-overlay">
            <div
              className={cn(
                'h-full transition-[width] duration-500',
                farOver ? 'bg-danger' : over ? 'bg-warn' : 'bg-accent'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="u-label text-text-faint">target {secondsToClock(targetSec)}</span>
        </div>
      )}
    </div>
  );
}
