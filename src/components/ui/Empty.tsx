import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Empty({
  title,
  hint,
  action,
  className
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded border border-dashed border-border px-6 py-12 text-center',
        className
      )}
    >
      <p className="u-label">{title}</p>
      {hint && <p className="max-w-[360px] text-[13px] text-text-faint">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
