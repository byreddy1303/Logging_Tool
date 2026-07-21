import { cn } from '@/lib/utils';
import { haptic } from '@/lib/native';

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
    <div role="tablist" className={cn('u-tabs flex gap-5 border-b border-border', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => {
              if (!active) haptic('selection');
              onChange(item.value);
            }}
            className={cn(
              'u-tab -mb-px border-b-2 pb-2 pt-1 text-[13px] transition-colors',
              active
                ? 'border-accent font-semibold text-text'
                : 'border-transparent font-medium text-text-faint hover:text-text-muted'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
