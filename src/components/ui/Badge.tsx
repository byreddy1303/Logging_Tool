import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'warn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const toneClasses: Record<Tone, string> = {
  neutral: 'border-border text-text-muted',
  accent: 'border-accent-faint text-accent',
  success: 'border-success/40 text-success',
  danger: 'border-danger/40 text-danger',
  warn: 'border-warn/40 text-warn'
};

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5',
        'font-mono text-[11px] uppercase tracking-[0.08em]',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
