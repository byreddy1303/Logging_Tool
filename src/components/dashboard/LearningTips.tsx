import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Lightbulb, MoveRight } from 'lucide-react';
import type { LearningTip } from '@/lib/learning-tips';
import { cn } from '@/lib/utils';

const TONE: Record<LearningTip['tone'], { line: string; icon: string; wash: string }> = {
  accent: { line: 'bg-accent', icon: 'text-accent', wash: 'bg-accent-faint/35' },
  rose: { line: 'bg-ink-rose', icon: 'text-ink-rose', wash: 'bg-ink-rose/5' },
  teal: { line: 'bg-ink-teal', icon: 'text-ink-teal', wash: 'bg-ink-teal/5' },
  marigold: { line: 'bg-ink-marigold', icon: 'text-ink-marigold', wash: 'bg-ink-marigold/5' }
};

export default function LearningTips({ tips }: { tips: LearningTip[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, tips.length - 1)));
  }, [tips.length]);

  if (tips.length === 0) return null;
  const tip = tips[index];
  const tone = TONE[tip.tone];

  return (
    <section className={cn('native-learning-tips relative overflow-hidden rounded-lg border border-border bg-bg-raised shadow-card', tone.wash)} aria-labelledby="learning-tip-title">
      <span className={cn('absolute inset-y-0 left-0 w-1', tone.line)} aria-hidden />
      <div className="native-learning-tips-content flex min-h-[116px] gap-3 px-5 py-4 sm:px-6">
        <Lightbulb size={18} strokeWidth={1.7} className={cn('mt-0.5 shrink-0', tone.icon)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="u-label text-text-muted">Learning note</p>
            <span className="u-num text-[10.5px] text-text-faint">{index + 1} / {tips.length}</span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.16 }}
            >
              <h2 id="learning-tip-title" className="mt-1 font-display text-[16px] font-semibold text-text">{tip.title}</h2>
              <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-text-muted">{tip.body}</p>
              {tip.href && tip.actionLabel && (
                <Link to={tip.href} className={cn('mt-2 inline-flex items-center gap-1 text-[12px] font-semibold hover:underline', tone.icon)}>
                  {tip.actionLabel} <MoveRight size={13} />
                </Link>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        {tips.length > 1 && (
          <div className="native-learning-controls flex shrink-0 items-center gap-1 self-end">
            <button
              type="button"
              onClick={() => setIndex((current) => (current - 1 + tips.length) % tips.length)}
              className="rounded-full border border-border bg-bg-raised p-1.5 text-text-faint hover:border-border-hover hover:text-text"
              aria-label="Previous learning tip"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setIndex((current) => (current + 1) % tips.length)}
              className="rounded-full border border-border bg-bg-raised p-1.5 text-text-faint hover:border-border-hover hover:text-text"
              aria-label="Next learning tip"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
