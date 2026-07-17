import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-sm',
        'border border-border bg-bg-raised px-1.5 shadow-[0_1.5px_0_theme(colors.border.hover)]',
        'font-mono text-[11px] font-semibold uppercase text-text-muted',
        className
      )}
      {...props}
    />
  );
}
