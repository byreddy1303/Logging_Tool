import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Render value in JetBrains Mono — for ids, tokens, numbers. */
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
        'h-9 w-full rounded-sm border border-border bg-bg px-3 text-sm text-text',
        'placeholder:text-text-faint',
        'transition-colors hover:border-border-hover focus:border-accent focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-60',
        mono && 'u-num',
        className
      )}
      {...props}
    />
  );
});
