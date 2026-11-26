import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { PipFigure, type PipPose } from './PipFigure';
import { nextIdle } from './idle';
import { lookFor, outfitFor } from './outfits';

/** Where Pip takes you: the Home dashboard. */
export const HOME_PATH = '/home';

/** How long one idle action plays before Pip settles back to rest. */
const ACTION_MS = 3000;

export interface PipEnv {
  reducedMotion: () => boolean;
  hour: () => number;
  random: () => number;
}

const browserEnv: PipEnv = {
  reducedMotion: () =>
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  hour: () => new Date().getHours(),
  random: Math.random,
};

const today = () => new Date().toISOString().slice(0, 10);

interface PipHomeButtonProps {
  /** The current subject, so Pip can dress for it. */
  subjectId?: string | null;
  /** In a lesson or test: Pip keeps still, and asks before leaving. */
  inLesson?: boolean;
  env?: PipEnv;
}

/**
 * Pip in a round button at the top left of every student screen (J15b, owner 2026-11-26). He leans
 * out of his frame; the tap target is the circle. Tapping him goes Home; in a lesson he first asks
 * "Leave this lesson?". He idles about every 8 seconds and stops after a minute without input.
 */
export function PipHomeButton({
  subjectId,
  inLesson = false,
  env = browserEnv,
}: PipHomeButtonProps) {
  const navigate = useNavigate();
  const [pose, setPose] = useState<PipPose>('rest');
  const [alive, setAlive] = useState(false);
  const [asking, setAsking] = useState(false);
  const [look] = useState(() => lookFor(today()));
  const returnFocus = useRef(false);
  const lastInput = useRef(Date.now());
  const [wake, setWake] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Any tap or key press counts as activity, and wakes Pip if he had stopped.
  useEffect(() => {
    const onInput = () => {
      const wasStopped = Date.now() - lastInput.current > 60_000;
      lastInput.current = Date.now();
      if (wasStopped) setWake((n) => n + 1);
    };
    window.addEventListener('pointerdown', onInput, true);
    window.addEventListener('keydown', onInput, true);
    return () => {
      window.removeEventListener('pointerdown', onInput, true);
      window.removeEventListener('keydown', onInput, true);
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let last: PipPose = 'rest';
    const plan = (delay: number) => {
      timer = setTimeout(() => {
        const next = nextIdle({
          idleMs: Date.now() - lastInput.current,
          hour: env.hour(),
          last,
          random: env.random,
          calm: inLesson,
          reducedMotion: env.reducedMotion(),
        });
        last = next.pose;
        setPose(next.pose);
        setAlive(next.delayMs !== null);
        if (next.pose !== 'rest' && next.pose !== 'nap') {
          settle = setTimeout(() => setPose('rest'), ACTION_MS);
        }
        if (next.delayMs !== null) plan(next.delayMs);
      }, delay);
    };
    setPose('rest');
    const first = nextIdle({
      idleMs: Date.now() - lastInput.current,
      hour: env.hour(),
      last,
      random: env.random,
      calm: inLesson,
      reducedMotion: env.reducedMotion(),
    });
    setAlive(first.delayMs !== null);
    if (first.delayMs !== null) plan(first.delayMs);
    return () => {
      clearTimeout(timer);
      clearTimeout(settle);
    };
  }, [env, inLesson, wake]);

  const goHome = useCallback(() => navigate(HOME_PATH), [navigate]);

  // Once the question has gone (and the page is no longer inert), focus goes back to Pip.
  useEffect(() => {
    if (!asking && returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [asking]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="pip-home"
        aria-label="Home"
        onClick={() => (inLesson ? setAsking(true) : goHome())}
      >
        <PipFigure outfit={outfitFor(subjectId)} look={look} pose={pose} alive={alive} />
      </button>
      {asking && (
        <LeaveDialog
          onStay={() => {
            returnFocus.current = true;
            setAsking(false);
          }}
          onLeave={goHome}
        />
      )}
    </>
  );
}

/**
 * "Leave this lesson?" as a modal (J15b-2 focus trap): it sits in its own layer, everything else
 * on the page is inert while it asks, Tab and Shift+Tab stay on its two buttons, and Escape or a
 * tap outside means Keep going.
 */
function LeaveDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const titleId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layer = layerRef.current;
    const others = Array.from(document.body.children).filter(
      (el) => el !== layer && !el.hasAttribute('inert'),
    );
    for (const el of others) el.setAttribute('inert', '');
    stayRef.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onStay();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      for (const el of others) el.removeAttribute('inert');
    };
  }, [onStay]);
  const trapTab = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return createPortal(
    <div ref={layerRef} className="pip-leave__backdrop" onClick={onStay}>
      <div
        className="pip-leave"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={trapTab}
      >
        <h2 id={titleId}>Leave this lesson?</h2>
        <div className="pip-leave__actions">
          <button ref={stayRef} type="button" className="btn btn--primary" onClick={onStay}>
            Keep going
          </button>
          <Button variant="secondary" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
