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
      <details className="rounded border border-border/70 bg-bg-overlay/40 px-3 py-2 text-[12px] text-text-muted">
        <summary className="cursor-pointer font-medium text-text-muted">
          What's a trigger sentence?
        </summary>
        <ul className="mt-2 flex flex-col gap-1.5 pl-4 leading-relaxed">
          <li>
            <span className="font-medium text-text">Quote the giveaway.</span>
            &nbsp;Copy the phrase in the question that <em>should have</em> made the method obvious.
          </li>
          <li>
            <span className="font-medium text-text">Examples that work:</span>
            &nbsp;"at least two share the same…", "for all n ≥ 1…", "the smallest such k",
            "strictly increasing sequence", "worst-case time".
          </li>
          <li>
            <span className="font-medium text-text">Then map it.</span>
            &nbsp;Format: <span className="u-num">"…quoted phrase…" → pattern/method</span>. E.g.,
            "at least two share…" → pigeonhole.
          </li>
          <li>
            <span className="font-medium text-text">Why this matters.</span>
            &nbsp;Trigger-drill later flashes these phrases at you and asks which method to use.
            Skip it and the reflex won't build.
          </li>
        </ul>
      </details>
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
