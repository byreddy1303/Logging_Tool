import { Kbd } from '@/components/ui/Kbd';
import { cn } from '@/lib/utils';

export type TagTone = 'ok' | 'slow' | 'guess' | 'wrong' | 'neutral';

const toneBar: Record<TagTone, string> = {
  ok: 'before:bg-success',
  slow: 'before:bg-warn',
  guess: 'before:bg-accent',
  wrong: 'before:bg-danger',
  neutral: 'before:bg-text-faint'
};

/** One keyboard-selectable row in a tag step. */
export default function TagOption({
  kbd,
  label,
  hint,
  tone = 'neutral',
  selected = false,
  onSelect
}: {
  kbd: string;
  label: string;
  hint?: string;
  tone?: TagTone;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex w-full items-center gap-3 border border-border bg-bg-raised px-4 py-3 text-left transition-colors',
        'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:opacity-0 before:transition-opacity',
        toneBar[tone],
        'hover:border-border-hover hover:bg-bg-overlay hover:before:opacity-100',
        selected && 'border-accent bg-bg-overlay before:opacity-100'
      )}
    >
      <Kbd className="shrink-0">{kbd}</Kbd>
      <span className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
        <span className="text-sm">{label}</span>
        {hint && <span className="truncate text-[12px] text-text-faint">{hint}</span>}
      </span>
    </button>
  );
}
