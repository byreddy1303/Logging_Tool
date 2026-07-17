import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 3, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full resize-y rounded border border-border bg-bg-raised px-3 py-2 text-sm text-text shadow-sm',
        'placeholder:text-text-faint',
        'transition-[border-color,box-shadow] hover:border-border-hover',
        'focus:border-accent focus:shadow-[0_0_0_3px_theme(colors.accent.faint)] focus:outline-none',
        'disabled:cursor-not-allowed disabled:bg-bg-overlay disabled:opacity-60',
        className
      )}
      {...props}
    />
  );
});
