import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <div className={cn('relative', className)}>
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded border border-border bg-bg-raised pl-3 pr-8 text-sm text-text shadow-sm',
          'transition-[border-color,box-shadow] hover:border-border-hover',
          'focus:border-accent focus:shadow-[0_0_0_3px_theme(colors.accent.faint)] focus:outline-none',
          'disabled:cursor-not-allowed disabled:bg-bg-overlay disabled:opacity-60'
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        strokeWidth={1.75}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-faint"
      />
    </div>
  );
});
