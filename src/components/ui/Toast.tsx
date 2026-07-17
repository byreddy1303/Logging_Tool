import { AnimatePresence, motion } from 'framer-motion';
import { useUiStore, type ToastTone } from '@/stores/ui';
import { cn } from '@/lib/utils';

const toneBar: Record<ToastTone, string> = {
  neutral: 'border-l-text-faint',
  success: 'border-l-success',
  danger: 'border-l-danger'
};

/** Bottom-right toast stack. Mount once in App. */
export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[280px] flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            onClick={() => dismiss(t.id)}
            className={cn(
              'pointer-events-auto border border-border border-l-2 bg-bg-overlay px-3 py-2 text-left',
              'font-mono text-xs text-text-muted',
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
