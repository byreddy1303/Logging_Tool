import { useEffect, useRef } from 'react';

/** Fires `onHidden` each time the document loses visibility (tab switch, app background). */
export function useVisibilityChange(onHidden: () => void, enabled = true): void {
  const cbRef = useRef(onHidden);
  cbRef.current = onHidden;
  useEffect(() => {
    if (!enabled) return;
    const onChange = () => {
      if (document.visibilityState === 'hidden') cbRef.current();
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [enabled]);
}
