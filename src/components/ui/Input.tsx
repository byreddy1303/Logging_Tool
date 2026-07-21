import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Render value in mono — for ids, tokens, numbers. */
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, mono, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={cn(
        'u-control h-10 w-full rounded border border-border bg-bg-raised px-3 text-sm text-text shadow-sm',
        'placeholder:text-text-faint',
        'transition-[border-color,box-shadow] hover:border-border-hover',
        'focus:border-accent focus:shadow-[0_0_0_3px_theme(colors.accent.faint)] focus:outline-none',
        'disabled:cursor-not-allowed disabled:bg-bg-overlay disabled:opacity-60',
        mono && 'u-num',
        className
      )}
      {...props}
    />
  );
});
