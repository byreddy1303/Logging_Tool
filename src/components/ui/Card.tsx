import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('u-panel', className)} {...props} />;
}

export function CardHeader({
  title,
  aside,
  className
}: {
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'u-card-header flex min-h-[40px] items-center justify-between gap-3 border-b border-border px-4 py-2',
        className
      )}
    >
      <h2 className="u-label">{title}</h2>
      {aside && <div className="flex items-center gap-2">{aside}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('u-card-body p-4', className)} {...props} />;
}
