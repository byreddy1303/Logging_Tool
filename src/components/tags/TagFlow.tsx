// 4-step tag pipeline (F2.2): Outcome → Pattern → Trigger → Root Cause.
// Keyboard-first; root cause is skipped when the outcome is R.
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Outcome, PatternRow, RootCause } from '@/types';
import { OUTCOME_BY_CODE } from '@/lib/constants';
import { cn, secondsToClock } from '@/lib/utils';

import OutcomeStep from '@/components/tags/OutcomeStep';
import PatternStep from '@/components/tags/PatternStep';
import TriggerStep from '@/components/tags/TriggerStep';
import RootCauseStep from '@/components/tags/RootCauseStep';

export interface TagDraft {
  outcome: Outcome;
  pattern_name: string | null;
  trigger_sentence: string | null;
  root_cause: RootCause | null;
}

type Step = 'outcome' | 'pattern' | 'trigger' | 'cause';

const STEP_LABELS: { id: Step; label: string }[] = [
  { id: 'outcome', label: 'outcome' },
  { id: 'pattern', label: 'pattern' },
  { id: 'trigger', label: 'trigger' },
  { id: 'cause', label: 'cause' }
];

const ADVANCE_FLASH_MS = 110;

const TONE_TEXT: Record<'ok' | 'slow' | 'guess' | 'wrong', string> = {
  ok: 'text-success',
  slow: 'text-warn',
  guess: 'text-guess',
  wrong: 'text-danger'
};

const stepVariants = {
  enter: (d: number) => ({ opacity: 0, x: 28 * d }),
  center: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: -22 * d, transition: { duration: 0.12 } })
};

export default function TagFlow({
  subject,
  patterns,
  questionLabel,
  timeSpentSec,
  onSave,
  onCancel
}: {
  subject: string;
  patterns: PatternRow[];
  questionLabel: string;
  timeSpentSec: number;
  onSave: (draft: TagDraft) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<Step>('outcome');
  const [outcome, setOutcome] = useState<Outcome>();
  const [pattern, setPattern] = useState<string | null>(null);
  const [trigger, setTrigger] = useState<string | null>(null);
  const [cause, setCause] = useState<RootCause>();
  const [saving, setSaving] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>();
  const dir = useRef(1);

  const steps = STEP_LABELS.filter((s) => s.id !== 'cause' || outcome !== 'R');

  function go(next: Step, d: 1 | -1) {
    dir.current = d;
    setStep(next);
  }

  async function finalize(draft: TagDraft) {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  function pickOutcome(o: Outcome) {
    if (saving) return;
    setOutcome(o);
    clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => go('pattern', 1), ADVANCE_FLASH_MS);
  }

  function submitPattern(name: string | null) {
    setPattern(name);
    go('trigger', 1);
  }

  function submitTrigger(text: string | null) {
    setTrigger(text);
    if (outcome === 'R') {
      void finalize({ outcome, pattern_name: pattern, trigger_sentence: text, root_cause: null });
    } else {
      go('cause', 1);
    }
  }

  function pickCause(rc: RootCause) {
    if (saving || !outcome) return;
    setCause(rc);
    void finalize({ outcome, pattern_name: pattern, trigger_sentence: trigger, root_cause: rc });
  }

  const activeIdx = steps.findIndex((s) => s.id === step);

  return (
    <div className="flex flex-col gap-5" data-testid="tag-flow">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <ol className="flex items-center gap-1.5">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-center gap-1.5">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn('h-px w-3', i <= activeIdx ? 'bg-accent/40' : 'bg-border')}
                />
              )}
              <span
                className={cn(
                  'flex h-5 items-center rounded-full px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors duration-150',
                  i === activeIdx
                    ? 'bg-accent text-white'
                    : i < activeIdx
                      ? 'bg-accent-faint text-accent'
                      : 'bg-bg-overlay text-text-faint'
                )}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        <span className="u-num text-[12px] text-text-muted">
          {questionLabel} · {secondsToClock(timeSpentSec)}
          {outcome && (
            <span className={cn('ml-2 font-semibold', TONE_TEXT[OUTCOME_BY_CODE[outcome].tone])}>
              {OUTCOME_BY_CODE[outcome].code}
            </span>
          )}
        </span>
      </div>

      <div className="overflow-x-clip">
        <AnimatePresence mode="popLayout" initial={false} custom={dir.current}>
          <motion.div
            key={step}
            custom={dir.current}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 480, damping: 38 }}
          >
            {step === 'outcome' && (
              <OutcomeStep selected={outcome} onSelect={pickOutcome} onCancel={onCancel} />
            )}
            {step === 'pattern' && (
              <PatternStep
                subject={subject}
                patterns={patterns}
                initial={pattern}
                onSubmit={submitPattern}
                onBack={() => go('outcome', -1)}
              />
            )}
            {step === 'trigger' && (
              <TriggerStep
                initial={trigger}
                onSubmit={submitTrigger}
                onBack={() => go('pattern', -1)}
              />
            )}
            {step === 'cause' && (
              <RootCauseStep selected={cause} onSelect={pickCause} onBack={() => go('trigger', -1)} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="u-label text-text-faint">
        {saving ? 'saving…' : 'esc goes back · this should take under 30 seconds'}
      </p>
    </div>
  );
}
