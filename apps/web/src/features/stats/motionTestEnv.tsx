import { act } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { MotionEnvProvider, type MotionEnv } from './countUp';

/**
 * A fake clock, frame loop and "comes into view" signal, so no real timers run. After `show()`,
 * anything that starts observing is in view at once, as with a real IntersectionObserver for
 * an element already on screen (a component may register a moment after the page renders).
 *
 * `show()` and `step()` first make React run any effects still waiting from a render that
 * happened outside `act` (data that loaded while `findBy…` was polling). Without that, the
 * tiles' observers could register only after the test had already stepped the clock, so the
 * counts never ran and the test failed under CPU load (K5c).
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
  // React runs pending passive effects before any new render, so a no-op update inside act
  // flushes them, deterministically.
  let nudge: (() => void) | null = null;
  const flush = () => act(() => nudge?.());
  const step = (ms: number) => {
    flush();
    act(() => {
      time += ms;
      const due = frames;
      frames = [];
      due.forEach((cb) => cb());
    });
  };
  const show = () => {
    flush();
    act(() => {
      inView = true;
      visible.splice(0).forEach((v) => v());
    });
  };
  function Flusher({ children }: { children: ReactNode }) {
    const [, setTick] = useState(0);
    nudge = () => setTick((t) => t + 1);
    return <>{children}</>;
  }
  const wrap = ({ children }: { children: ReactNode }) => (
    <MotionEnvProvider value={env}>
      <Flusher>{children}</Flusher>
    </MotionEnvProvider>
  );
  return { env, step, show, wrap };
}
