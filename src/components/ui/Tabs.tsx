import { cn } from '@/lib/utils';

export interface TabItem<T extends string = string> {
  value: T;
  label: string;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('flex gap-4 border-b border-border', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'u-label -mb-px border-b pb-2 pt-1 transition-colors',
              active
                ? 'border-accent text-text'
                : 'border-transparent text-text-faint hover:text-text-muted'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
