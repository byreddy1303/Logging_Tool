// Lightweight markdown-ish renderer for LLM responses. Handles:
//   - "## Heading" lines as bold labels
//   - "### Heading" as smaller subheadings
//   - fenced ``` code blocks
//   - blank-line paragraphs
//   - inline `code` spans
//   - `**bold**` and `_italic_` inside paragraphs
// LaTeX is left as-is (rendered verbatim); a real KaTeX pass is future work.
import { Fragment } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  text: string;
  className?: string;
}

function renderInline(text: string): (JSX.Element | string)[] {
  // Match `code`, **bold**, _italic_ — anything else is literal.
  const tokens: (JSX.Element | string)[] = [];
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*|_[^_\n]+_)/g;
  let idx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > idx) tokens.push(text.slice(idx, match.index));
    const t = match[0];
    if (t.startsWith('`')) {
      tokens.push(
        <code
          key={`c${key++}`}
          className="rounded bg-bg-overlay px-1 py-0.5 font-mono text-[12px] text-accent"
        >
          {t.slice(1, -1)}
        </code>
      );
    } else if (t.startsWith('**')) {
      tokens.push(
        <strong key={`b${key++}`} className="font-semibold text-text">
          {t.slice(2, -2)}
        </strong>
      );
    } else {
      tokens.push(
        <em key={`i${key++}`} className="italic">
          {t.slice(1, -1)}
        </em>
      );
    }
    idx = match.index + t.length;
  }
  if (idx < text.length) tokens.push(text.slice(idx));
  return tokens;
}

export default function MarkdownLite({ text, className }: Props) {
  const blocks: JSX.Element[] = [];
  const lines = text.split(/\r?\n/);
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block.
    if (line.startsWith('```')) {
      const collected: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        collected.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      blocks.push(
        <pre
          key={`code${key++}`}
          className="overflow-x-auto rounded border border-border bg-bg-overlay px-3 py-2 font-mono text-[12px] text-text"
        >
          {collected.join('\n')}
        </pre>
      );
      continue;
    }
    // Headings.
    if (line.startsWith('## ')) {
      blocks.push(
        <h3
          key={`h${key++}`}
          className="mt-4 border-b border-border/60 pb-1 font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-text first:mt-0"
        >
          {line.slice(3)}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={`h${key++}`} className="mt-3 font-display text-[13px] font-medium text-text">
          {line.slice(4)}
        </h4>
      );
      i++;
      continue;
    }
    // Blank → paragraph break, skip.
    if (!line.trim()) {
      i++;
      continue;
    }
    // Paragraph: collect until blank.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('```') && !lines[i].startsWith('## ')) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`p${key++}`} className="text-[13.5px] leading-relaxed text-text-muted">
        {para.map((l, ix) => (
          <Fragment key={ix}>
            {ix > 0 && <br />}
            {renderInline(l)}
          </Fragment>
        ))}
      </p>
    );
  }
  return <div className={cn('flex flex-col gap-2', className)}>{blocks}</div>;
}
