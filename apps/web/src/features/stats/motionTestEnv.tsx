import { act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MotionEnvProvider, type MotionEnv } from './countUp';

/** A fake clock, frame loop and "comes into view" signal, so no real timers run. */
export function fakeMotionEnv({ reduced = false } = {}) {
  let time = 0;
  let frames: (() => void)[] = [];
  const visible: (() => void)[] = [];
  const env: MotionEnv = {
    now: () => time,
    requestFrame: (cb) => {
      frames.push(cb);
      return frames.length;
    },
    cancelFrame: () => undefined,
    observe: (_el, onVisible) => {
      visible.push(onVisible);
      return () => undefined;
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
  const show = () => act(() => visible.forEach((v) => v()));
  const wrap = ({ children }: { children: ReactNode }) => (
    <MotionEnvProvider value={env}>{children}</MotionEnvProvider>
  );
  return { env, step, show, wrap };
}
