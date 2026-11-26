import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MotionEnvProvider, type MotionEnv } from './countUp';

/**
 * A fake clock, frame loop and "comes into view" signal, so no real timers run. After `show()`,
 * anything that starts observing is in view at once, as with a real IntersectionObserver for
 * an element already on screen (a component may register a moment after the page renders).
 */
export function fakeMotionEnv({ reduced = false } = {}) {
  let time = 0;
  let frames: (() => void)[] = [];
  const visible: (() => void)[] = [];
  let inView = false;
  const env: MotionEnv = {
    now: () => time,
    requestFrame: (cb) => {
      frames.push(cb);
      return frames.length;
    },
    cancelFrame: () => undefined,
    observe: (_el, onVisible) => {
      if (inView) {
        onVisible();
        return () => undefined;
      }
      visible.push(onVisible);
      return () => {
        const i = visible.indexOf(onVisible);
        if (i >= 0) visible.splice(i, 1);
      };
    },
    reducedMotion: () => reduced,
  };
  const step = (ms: number) =>
    act(() => {
      time += ms;
      const due = frames;
      frames = [];
      due.forEach((cb) => cb());
    });
  const show = () =>
    act(() => {
      inView = true;
      visible.splice(0).forEach((v) => v());
    });
  const wrap = ({ children }: { children: ReactNode }) => (
    <MotionEnvProvider value={env}>{children}</MotionEnvProvider>
  );
  return { env, step, show, wrap };
}
