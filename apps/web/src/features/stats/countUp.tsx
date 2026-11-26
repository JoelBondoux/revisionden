import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { COUNT_UP_MS, countUpValue } from '@revisionden/core';

/**
 * Count-up numbers and enter animations for the stats pages (workstream K5). Each runs once,
 * the first time its element comes into view, and never again on a re-render or refetch.
 * Reduced motion, or a browser without IntersectionObserver, shows the final value at once.
 * Time, frames and "comes into view" come from a MotionEnv, so tests need no real timers.
 */
export interface MotionEnv {
  now(): number;
  requestFrame(cb: () => void): number;
  cancelFrame(id: number): void;
  /** Calls onVisible once when the element first comes into view; null where unsupported. */
  observe: ((el: Element, onVisible: () => void) => () => void) | null;
  reducedMotion(): boolean;
}

function browserEnv(): MotionEnv {
  const hasWindow = typeof window !== 'undefined';
  return {
    now: () => (hasWindow ? window.performance.now() : Date.now()),
    requestFrame: (cb) => window.requestAnimationFrame(cb),
    cancelFrame: (id) => window.cancelAnimationFrame(id),
    observe:
      !hasWindow || typeof window.IntersectionObserver === 'undefined'
        ? null
        : (el, onVisible) => {
            const io = new window.IntersectionObserver((entries) => {
              if (entries.some((e) => e.isIntersecting)) {
                io.disconnect();
                onVisible();
              }
            });
            io.observe(el);
            return () => io.disconnect();
          },
    reducedMotion: () => {
      try {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      } catch {
        return false;
      }
    },
  };
}

const MotionEnvContext = createContext<MotionEnv | null>(null);

export function MotionEnvProvider({ value, children }: { value: MotionEnv; children: ReactNode }) {
  return <MotionEnvContext.Provider value={value}>{children}</MotionEnvContext.Provider>;
}

function useMotionEnv(): MotionEnv {
  const injected = useContext(MotionEnvContext);
  const [fallback] = useState(browserEnv);
  return injected ?? fallback;
}

/** static: no animation at all; waiting: not yet in view; running; done: ran once. */
export type EnterPhase = 'static' | 'waiting' | 'running' | 'done';

/** Runs an enter animation of `totalMs` once, the first time `ref` comes into view. */
export function useEnterOnce<T extends Element>(
  totalMs: number,
): { ref: RefObject<T>; phase: EnterPhase; elapsed: number } {
  const env = useMotionEnv();
  const ref = useRef<T>(null);
  const start = useRef(0);
  const [phase, setPhase] = useState<EnterPhase>(() =>
    env.observe && !env.reducedMotion() ? 'waiting' : 'static',
  );
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (phase !== 'waiting' || !el || !env.observe) return undefined;
    return env.observe(el, () => {
      start.current = env.now();
      setPhase('running');
    });
  }, [env, phase]);

  useEffect(() => {
    if (phase !== 'running') return undefined;
    let id = 0;
    const tick = () => {
      const e = env.now() - start.current;
      setElapsed(e);
      if (e >= totalMs) setPhase('done');
      else id = env.requestFrame(tick);
    };
    id = env.requestFrame(tick);
    return () => env.cancelFrame(id);
  }, [env, phase, totalMs]);

  return { ref, phase, elapsed };
}

interface CountUpProps {
  value: number;
  /** Formats every frame the same way as the final value ("85%", "1 h 20 min", "1,234"). */
  format: (value: number) => string;
  decimals?: number;
  /** Stagger before this number starts (see `staggerDelay`). */
  delayMs?: number;
  /** Called once, when an animated count has finished. Never called without animation. */
  onSettled?: () => void;
}

/**
 * A number that counts up from 0 once. Screen readers only ever get the final value (in hidden
 * text); the moving digits are aria-hidden, use tabular figures and keep the final width, so
 * nothing shifts while they count.
 */
export function CountUp({ value, format, decimals = 0, delayMs = 0, onSettled }: CountUpProps) {
  const { ref, phase, elapsed } = useEnterOnce<HTMLSpanElement>(COUNT_UP_MS + delayMs);
  const settled = useRef(false);
  useEffect(() => {
    if (phase !== 'done' || settled.current) return;
    settled.current = true;
    onSettled?.();
  }, [phase, onSettled]);

  const final = format(value);
  if (phase === 'static' || phase === 'done') {
    return (
      <span ref={ref} className="count-up">
        {final}
      </span>
    );
  }
  const shown = phase === 'waiting' ? 0 : countUpValue(value, elapsed - delayMs, { decimals });
  return (
    <span ref={ref} className="count-up">
      <span className="visually-hidden">{final}</span>
      <span
        aria-hidden="true"
        className="count-up__digits"
        style={{ minWidth: `${final.length}ch` }}
      >
        {format(shown)}
      </span>
    </span>
  );
}

const GROW_CLASS: Partial<Record<EnterPhase, string>> = {
  waiting: 'stats-grow--waiting',
  running: 'stats-grow--running',
};

/**
 * Progress bars inside grow in from the left once, the first time they come into view. The
 * bars keep their roles and values, so screen readers always get the final numbers.
 */
export function GrowIn({ children }: { children: ReactNode }) {
  const { ref, phase } = useEnterOnce<HTMLDivElement>(COUNT_UP_MS);
  const extra = GROW_CLASS[phase];
  return (
    <div ref={ref} className={extra ? `stats-grow ${extra}` : 'stats-grow'}>
      {children}
    </div>
  );
}
