import { useEffect, useSyncExternalStore } from 'react';

/**
 * J14b: a lesson shows Pip in its own header row. While one does, the layout leaves out its Pip
 * row (it stays for a lesson's loading and error screens, so there is always a way Home).
 */
let claims = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listen) => listen());

/** Called by the lesson that shows Pip in its header. */
export function useShowsLessonPip(): void {
  useEffect(() => {
    claims += 1;
    notify();
    return () => {
      claims -= 1;
      notify();
    };
  }, []);
}

/** True while a lesson on screen shows its own Pip. */
export function useLessonShowsPip(): boolean {
  return useSyncExternalStore(
    (listen) => {
      listeners.add(listen);
      return () => listeners.delete(listen);
    },
    () => claims > 0,
  );
}
