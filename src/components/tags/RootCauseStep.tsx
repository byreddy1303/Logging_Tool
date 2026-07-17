import type { RootCause } from '@/types';
import { ROOT_CAUSES } from '@/lib/constants';
import { useKeyboard } from '@/hooks/useKeyboard';
import TagOption from '@/components/tags/TagOption';

export default function RootCauseStep({
  selected,
  onSelect,
  onBack
}: {
  selected?: RootCause;
  onSelect: (rc: RootCause) => void;
  onBack: () => void;
}) {
  useKeyboard({
    escape: onBack,
    ...Object.fromEntries(ROOT_CAUSES.map((rc) => [rc.key, () => onSelect(rc.value)]))
  });
  return (
    <div className="flex flex-col gap-1.5">
      {ROOT_CAUSES.map((rc) => (
        <TagOption
          key={rc.value}
          kbd={rc.key}
          label={rc.label}
          hint={rc.hint}
          selected={selected === rc.value}
          onSelect={() => onSelect(rc.value)}
        />
      ))}
    </div>
  );
}
