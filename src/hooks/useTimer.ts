import { useEffect, useState } from 'react';

/** Seconds elapsed since `startedAtMs` (epoch ms). Derived from the clock, so it never drifts. */
export function useTimer(startedAtMs: number | null): number {
  const [seconds, setSeconds] = useState(() =>
    startedAtMs === null ? 0 : Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
  );
  useEffect(() => {
    if (startedAtMs === null) {
      setSeconds(0);
      return;
    }
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [startedAtMs]);
  return seconds;
}
