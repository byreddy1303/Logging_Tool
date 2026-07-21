import { cn } from '@/lib/utils';

type BrandSize = 'sm' | 'md' | 'lg';

const MARK_SIZE: Record<BrandSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-14 w-14'
};

const WORD_SIZE: Record<BrandSize, string> = {
  sm: 'text-[15px]',
  md: 'text-[19px]',
  lg: 'text-[28px]'
};

export function BrandMark({
  className,
  decorative = false
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      src="/air-mark.svg"
      alt={decorative ? '' : 'AIR Journal logo'}
      aria-hidden={decorative || undefined}
      draggable={false}
      className={cn('block shrink-0 select-none', className)}
    />
  );
}

export default function Brand({
  size = 'md',
  className
}: {
  size?: BrandSize;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)} aria-label="AIR Journal">
      <BrandMark className={MARK_SIZE[size]} decorative />
      <span className="flex flex-col" aria-hidden="true">
        <span
          className={cn(
            'font-display font-bold leading-[0.82] tracking-tight text-text',
            WORD_SIZE[size]
          )}
        >
          AIR<span className="text-accent">.</span>
        </span>
        <span className="mt-1 font-mono text-[8px] font-semibold uppercase leading-none tracking-[0.2em] text-text-faint">
          Journal
        </span>
      </span>
    </span>
  );
}
