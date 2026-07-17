import type { Outcome } from '@/types';
import { OUTCOME_BY_CODE, type OutcomeSpec } from '@/lib/constants';
import { cn } from '@/lib/utils';

const toneClasses: Record<OutcomeSpec['tone'], string> = {
  ok: 'border-success/40 text-success',
  slow: 'border-warn/40 text-warn',
  guess: 'border-accent/40 text-accent-hover',
  wrong: 'border-danger/40 text-danger'
};

export default function OutcomeBadge({
  outcome,
  className
}: {
  outcome: Outcome;
  className?: string;
}) {
  const spec = OUTCOME_BY_CODE[outcome];
  return (
    <span
      title={spec.label}
      className={cn(
        'inline-flex items-center rounded-sm border px-1.5 py-px font-mono text-[11px] tracking-wider',
        toneClasses[spec.tone],
        className
      )}
    >
      {outcome}
    </span>
  );
}
