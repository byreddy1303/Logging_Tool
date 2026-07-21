import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useUiStore, type ToastTone } from '@/stores/ui';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/native';

const toneBar: Record<ToastTone, string> = {
  neutral: 'border-l-text-faint',
  success: 'border-l-success',
  danger: 'border-l-danger'
};

/** Bottom-right toast stack. Mount once in App. */
export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  const notified = useRef(new Set<number>());

  useEffect(() => {
    for (const item of toasts) {
      if (notified.current.has(item.id)) continue;
      notified.current.add(item.id);
      if (item.tone === 'success') haptic('success');
      if (item.tone === 'danger') haptic('error');
    }
  }, [toasts]);

  return (
    <div
      aria-live="polite"
      className="u-toaster pointer-events-none fixed bottom-[calc(1rem+var(--safe-bottom))] right-[calc(1rem+var(--safe-right))] z-50 flex w-[min(300px,calc(100vw-2rem))] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            layout
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            onClick={() => dismiss(t.id)}
            className={cn(
              'u-toast pointer-events-auto rounded border border-border border-l-[3px] bg-bg-raised px-3 py-2.5 text-left shadow-lift',
              'text-[13px] font-medium text-text',
              toneBar[t.tone]
            )}
          >
            {t.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
