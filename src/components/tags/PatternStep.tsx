import { useMemo, useRef, useState, useEffect } from 'react';
import type { PatternRow } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn, levenshtein } from '@/lib/utils';

const MAX_SUGGESTIONS = 6;

/** Fuzzy match per F2.2: substring or Levenshtein distance ≤ 2. */
function matches(input: string, name: string): boolean {
  const q = input.trim().toLowerCase();
  const n = name.toLowerCase();
  return n.includes(q) || levenshtein(q, n) <= 2;
}

export default function PatternStep({
  subject,
  patterns,
  initial,
  onSubmit,
  onBack
}: {
  subject: string;
  patterns: PatternRow[];
  initial?: string | null;
  onSubmit: (name: string | null) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState(initial ?? '');
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const suggestions = useMemo(() => {
    const pool = text.trim()
      ? patterns.filter((p) => matches(text, p.name))
      : patterns.filter((p) => p.subject === subject);
    return [...pool]
      .sort(
        (a, b) =>
          Number(b.subject === subject) - Number(a.subject === subject) || b.count - a.count
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [text, patterns, subject]);

  const exact = suggestions.some((p) => p.name.toLowerCase() === text.trim().toLowerCase());

  function submit(name: string | null) {
    onSubmit(name && name.trim() ? name.trim() : null);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onBack();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (suggestions.length ? (h + 1) % suggestions.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (suggestions.length ? (h - 1 + suggestions.length) % suggestions.length : -1));
    } else if (e.key === 'Tab' && highlight >= 0 && suggestions[highlight]) {
      e.preventDefault();
      setText(suggestions[highlight].name);
      setHighlight(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && suggestions[highlight]) submit(suggestions[highlight].name);
      else submit(text);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setHighlight(-1);
        }}
        onKeyDown={onKeyDown}
        placeholder="e.g. pigeonhole on remainders"
        aria-label="Pattern name"
      />
      {suggestions.length > 0 && (
        <div className="flex flex-col divide-y divide-border border border-border">
          {suggestions.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => submit(p.name)}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                'flex items-baseline justify-between gap-3 px-3 py-2 text-left text-sm transition-colors',
                i === highlight ? 'bg-bg-overlay text-text' : 'text-text-muted hover:bg-bg-overlay'
              )}
            >
              <span className="truncate">{p.name}</span>
              <span className="u-num shrink-0 text-[11px] text-text-faint">×{p.count}</span>
            </button>
          ))}
        </div>
      )}
      {text.trim() && !exact && (
        <p className="u-label text-accent-hover">new pattern — “{text.trim()}”</p>
      )}
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-text-faint">
          3–5 words naming the reusable trick. Enter saves · empty skips.
        </p>
        <Button variant="ghost" size="sm" onClick={() => submit(null)}>
          Skip
        </Button>
      </div>
    </div>
  );
}
