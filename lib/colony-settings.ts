import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_COLONY_DIRECTION, type ColonyDirection } from './colony-status';

const key = 'vitani-prvaku.colony-direction';
const valid = (value: unknown): value is ColonyDirection => value === 'degrade' || value === 'improve';

export function useColonyDirection(enabled = true) {
  const [direction, setDirection] = useState(DEFAULT_COLONY_DIRECTION);
  const [saved, setSaved] = useState(true);
  const apply = useCallback((value: ColonyDirection) => {
    if (!valid(value)) return;
    setDirection(value);
    let stored = false;
    try { localStorage.setItem(key, value); stored = localStorage.getItem(key) === value; } catch { /* Keep the live setting. */ }
    setSaved(stored);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let value: unknown;
    try { value = localStorage.getItem(key); } catch { /* Use the default. */ }
    // eslint-disable-next-line react/react-compiler -- Restore persisted device settings after mount.
    apply(valid(value) ? value : DEFAULT_COLONY_DIRECTION);
    const receive = (event: Event) => { const value: unknown = (event as CustomEvent).detail; if (valid(value)) apply(value); };
    window.addEventListener('michas:colony-direction', receive);
    return () => window.removeEventListener('michas:colony-direction', receive);
  }, [apply, enabled]);
  return { direction, saved, setDirection: apply };
}
