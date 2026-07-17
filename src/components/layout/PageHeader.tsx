import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function PageHeader({
  title,
  description,
  actions,
  className
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-3 pb-6', className)}>
      <div>
        <h1 className="font-mono text-lg font-medium tracking-[0.02em]">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
