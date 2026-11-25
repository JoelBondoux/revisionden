import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function query(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(QUERY);
}

/** True when the device asks for reduced motion. Effects then turn off; text and colour remain. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const list = query();
    if (!list) return undefined;
    const onChange = () => setReduced(list.matches);
    onChange();
    list.addEventListener?.('change', onChange);
    return () => list.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}
