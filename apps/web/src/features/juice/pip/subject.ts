import { useSyncExternalStore } from 'react';

/**
 * The subject Pip dresses for: the one last shown on the map (J15b). Kept in memory only, never
 * saved on the device, so it needs no storage notice; after a reload Pip is plain until the map
 * loads again.
 */
let current: string | null = null;
const listeners = new Set<() => void>();

export function setPipSubject(subjectId: string | null): void {
  if (subjectId === current) return;
  current = subjectId;
  for (const listen of listeners) listen();
}

export function usePipSubject(): string | null {
  return useSyncExternalStore(
    (listen) => {
      listeners.add(listen);
      return () => listeners.delete(listen);
    },
    () => current,
  );
}
