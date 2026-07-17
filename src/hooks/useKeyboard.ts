import { useEffect, useRef } from 'react';

type KeyMap = Record<string, (e: KeyboardEvent) => void>;

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Global keyboard shortcuts. Keys are lowercase `event.key` values
 * (e.g. 'r', '1', 'enter', 'escape'). Ignores modified keys and events
 * originating in editable elements — inputs handle their own keys.
 */
export function useKeyboard(map: KeyMap, enabled = true): void {
  const mapRef = useRef(map);
  mapRef.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;
      const handler = mapRef.current[e.key.toLowerCase()];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
