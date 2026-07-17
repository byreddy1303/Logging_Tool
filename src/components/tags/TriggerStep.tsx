import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function TriggerStep({
  initial,
  onSubmit,
  onBack
}: {
  initial?: string | null;
  onSubmit: (text: string | null) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState(initial ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  function submit() {
    onSubmit(text.trim() ? text.trim() : null);
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onBack();
          }
        }}
        placeholder="“…at least two of them share…” → pigeonhole"
        aria-label="Trigger sentence"
      />
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-text-faint">
          The exact words that should have fired the method. Enter saves · empty skips.
        </p>
        <Button variant="ghost" size="sm" onClick={() => onSubmit(null)}>
          Skip
        </Button>
      </div>
    </div>
  );
}
