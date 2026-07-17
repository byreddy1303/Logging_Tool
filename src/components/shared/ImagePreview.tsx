// Full-screen image preview triggered by clicking a Journal thumbnail. Works
// with both DataURL (locally-uploaded) and remote-URL images.
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';

export function ImagePreview({
  src,
  caption,
  open,
  onClose
}: {
  src: string | null;
  caption?: string;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-text/70 p-4 backdrop-blur-[3px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="absolute right-4 top-4 rounded-full bg-bg-raised/90 p-2 text-text shadow-lift transition-colors hover:bg-bg-raised"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
          <motion.img
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            src={src}
            alt={caption ?? 'Question image'}
            className="max-h-[85vh] max-w-full rounded shadow-lift"
          />
          {caption && (
            <p className="mt-3 max-w-lg text-center text-[12px] text-bg-raised/90">{caption}</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
