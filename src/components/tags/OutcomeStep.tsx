import type { Outcome } from '@/types';
import { OUTCOMES } from '@/lib/constants';
import { useKeyboard } from '@/hooks/useKeyboard';
import TagOption from '@/components/tags/TagOption';

export default function OutcomeStep({
  selected,
  onSelect,
  onCancel
}: {
  selected?: Outcome;
  onSelect: (o: Outcome) => void;
  onCancel: () => void;
}) {
  useKeyboard({
    escape: onCancel,
    ...Object.fromEntries(OUTCOMES.map((o) => [o.key, () => onSelect(o.code)]))
  });
  return (
    <div className="flex flex-col gap-1.5">
      {OUTCOMES.map((o) => (
        <TagOption
          key={o.code}
          kbd={o.key.toUpperCase()}
          label={o.label}
          hint={o.hint}
          tone={o.tone}
          selected={selected === o.code}
          onSelect={() => onSelect(o.code)}
        />
      ))}
    </div>
  );
}
