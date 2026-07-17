import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm',
        'border border-border bg-bg-overlay px-1',
        'font-mono text-[11px] text-text-muted',
        className
      )}
      {...props}
    />
  );
}
