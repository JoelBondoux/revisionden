import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Pip, type PipMood } from '../../components/Pip';
import { burstParticles, confettiPieces, rollValue, showsComboBadge, type Random } from './logic';
import { useReducedMotion } from './motion';
import './juice.css';

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** Particles flying out from the chosen option (about 20, 0.8 s). Off with reduced motion. */
export function ParticleBurst({
  count = 20,
  random = Math.random,
}: {
  count?: number;
  random?: Random;
}) {
  const reduced = useReducedMotion();
  const particles = useMemo(() => burstParticles(count, random), [count, random]);
  if (reduced) return null;
  return (
    <span className="burst" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className={`burst__particle spark-${p.colour}`}
          style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--size': `${p.size}px` } as Vars}
        />
      ))}
    </span>
  );
}

/** Text such as "+10 XP" that floats up and fades. Decorative: the result text says it too. */
export function FloatUp({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <span className="float-up" aria-hidden="true">
      {children}
    </span>
  );
}

/** A small horizontal shake (0.4 s) for a wrong answer. Never shakes with reduced motion. */
export function Shake({ active, children }: { active: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  return <div className={active && !reduced ? 'shake' : undefined}>{children}</div>;
}

/** "COMBO ×n" from 2 right in a row; it pops in again each time the combo grows. */
export function ComboBadge({ combo }: { combo: number }) {
  if (!showsComboBadge(combo)) return null;
  return (
    <p key={combo} className="combo-badge">
      COMBO ×{combo}
    </p>
  );
}

function Star({ earned, delayMs }: { earned: boolean; delayMs: number }) {
  return (
    <svg
      className={`star ${earned ? 'star--earned' : 'star--empty'}`}
      style={earned ? { animationDelay: `${delayMs}ms` } : undefined}
      viewBox="0 0 48 48"
      width="56"
      height="56"
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="24,3 30,18 46,18 33,28 38,44 24,35 10,44 15,28 2,18 18,18" />
    </svg>
  );
}

/** Stars that pop in one by one (0.4 s apart). */
export function StarReveal({ stars, max = 3 }: { stars: number; max?: number }) {
  return (
    <div className="stars" role="img" aria-label={`${stars} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} earned={i < stars} delayMs={i * 400} />
      ))}
    </div>
  );
}

/** Confetti over the whole screen, capped. Off with reduced motion. */
export function Confetti({ count, random = Math.random }: { count?: number; random?: Random }) {
  const reduced = useReducedMotion();
  const pieces = useMemo(() => confettiPieces(count, random), [count, random]);
  if (reduced) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`confetti__piece spark-${p.colour}`}
          style={
            {
              left: `${p.left}%`,
              animationDelay: `${p.delayMs}ms`,
              '--spin': `${p.spin}deg`,
              '--drift': `${p.drift}px`,
            } as Vars
          }
        />
      ))}
    </div>
  );
}

interface RollingNumberProps {
  value: number;
  label: string;
  suffix?: string;
  durationMs?: number;
}

/**
 * A counter that rolls up to a new value. Screen readers get the final value at once (in hidden
 * text); the rolling digits are only visual. Reduced motion jumps straight to the value.
 */
export function RollingNumber({ value, label, suffix = '', durationMs = 600 }: RollingNumberProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const from = shownRef.current;
    if (reduced || from === value) {
      shownRef.current = value;
      setShown(value);
      return undefined;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      const next = rollValue(from, value, (Date.now() - start) / durationMs);
      shownRef.current = next;
      setShown(next);
      if (next === value) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value, reduced, durationMs]);

  return (
    <span className="rolling-number">
      <span className="visually-hidden">{`${label}: ${value}${suffix}`}</span>
      <span aria-hidden="true">
        {shown}
        {suffix}
      </span>
    </span>
  );
}

interface ArenaProgressProps {
  label: string;
  value: number;
  max: number;
  valueText?: string;
}

/** A glowing progress bar with a springy overshoot (transform only, so it stays smooth). */
export function ArenaProgress({ label, value, max, valueText }: ArenaProgressProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const fraction = max > 0 ? clamped / max : 0;
  return (
    <div
      className="arena-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
    >
      <div className="arena-progress__fill" style={{ transform: `scaleX(${fraction})` }} />
    </div>
  );
}

/** Pip, in the established mockup 6 art, with a short speech line. */
export function PipSays({ line, mood = 'happy' }: { line: string; mood?: PipMood }) {
  return (
    <div className="pip-says">
      <Pip size={64} mood={mood} />
      <p className="pip-says__bubble">{line}</p>
    </div>
  );
}
