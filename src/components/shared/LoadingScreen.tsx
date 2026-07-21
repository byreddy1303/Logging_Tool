import { motion, useReducedMotion } from 'motion/react';

export default function LoadingScreen() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16, delay: reduceMotion ? 0 : 0.1 }}
        className="text-center"
      >
        <p className="font-display text-[22px] font-bold tracking-tight text-text">
          AIR<span className="text-accent">.</span>
        </p>
        <p className="u-label mt-1">loading</p>
      </motion.div>
    </div>
  );
}
