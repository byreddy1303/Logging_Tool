import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function PageHeader({
  title,
  description,
  actions,
  className
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-3 pb-6', className)}>
      <div className="u-margin-line">
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight text-text">
          {title}
        </h1>
        {description && <p className="mt-0.5 text-[13.5px] text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
