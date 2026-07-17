import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/* Key-cap physics: rest on a hard under-shadow, sink into it on press. */
const variantClasses: Record<Variant, string> = {
  primary: cn(
    'bg-accent font-semibold text-white shadow-[0_2px_0_#a5311b]',
    'hover:-translate-y-px hover:bg-accent-hover hover:shadow-[0_3px_0_#a5311b]',
    'active:translate-y-[2px] active:shadow-none'
  ),
  secondary: cn(
    'border border-border bg-bg-raised font-medium text-text shadow-[0_2px_0_theme(colors.border.DEFAULT)]',
    'hover:-translate-y-px hover:border-border-hover hover:shadow-[0_3px_0_theme(colors.border.hover)]',
    'active:translate-y-[2px] active:shadow-none'
  ),
  ghost: 'font-medium text-text-muted hover:bg-bg-overlay hover:text-text active:scale-[0.97]',
  danger: cn(
    'border border-danger/40 font-medium text-danger shadow-[0_2px_0_theme(colors.danger.faint)]',
    'hover:border-danger hover:bg-danger-faint',
    'active:translate-y-[2px] active:shadow-none'
  )
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 rounded',
        'transition-[transform,background-color,border-color,box-shadow,color] duration-100',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
});
