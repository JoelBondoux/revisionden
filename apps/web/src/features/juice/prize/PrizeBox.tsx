import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { RewardCardResponse } from '@revisionden/core';
import { rewardReason } from '../../rewards/RewardReveal';
import { itemWords } from '../../rewards/parts';
import { RewardSound } from '../../sound/RewardSound';
import { useSound } from '../../sound/SoundProvider';
import { useReducedMotion } from '../motion';
import { celebrate } from '../particles/burst';
import { PRIZE_STEP_EVENT } from '../particles/sound';
import './prize.css';

/** The prize box's beats, in ms (the owner-approved mockup). */
export const PRIZE_TIMINGS = {
  dropMs: 650,
  wobbleMs: [520, 520, 560] as const,
  itemGapMs: 650,
  itemBurstMs: 420,
};

type Stage = 'closed' | 'open' | 'done';

interface PrizeBoxProps {
  rewards: readonly RewardCardResponse[];
  onClose: () => void;
}

/**
 * Newly earned rewards in a den prize box (J17): it drops in, wobbles three times (tap to skip),
 * bursts open and each reward pops out with its reason, then Collect. It always shows exactly
 * what was earned and why: no random draws. With reduced motion it opens at once with the list.
 */
export function PrizeBox({ rewards, onClose }: PrizeBoxProps) {
  const reduced = useReducedMotion();
  const { emit } = useSound();
  const headingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boxRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const collectRef = useRef<HTMLButtonElement>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [stage, setStage] = useState<Stage>(reduced ? 'done' : 'closed');
  const [wobble, setWobble] = useState(0);
  const [shown, setShown] = useState(reduced ? rewards.length : 0);

  const clearAll = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current.clear();
  }, []);
  const at = useCallback((ms: number, step: () => void) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      step();
    }, ms);
    timers.current.add(t);
  }, []);

  // Bursts open, then each reward pops out in turn, then Collect.
  const open = useCallback(() => {
    clearAll();
    setStage('open');
    emit('rewardOpen');
    celebrate('prizeOpen', boxRef.current);
    const reveal = (i: number) => {
      setShown(i + 1);
      // U8's three-step prize sound (nodePop until it lands). The box has its own sounds, so its
      // bursts add none.
      emit(PRIZE_STEP_EVENT, { step: Math.min(i + 1, 3) });
      at(PRIZE_TIMINGS.itemBurstMs, () =>
        celebrate('prizeItem', listRef.current?.children[i] ?? null),
      );
    };
    rewards.forEach((_, i) =>
      i === 0 ? reveal(0) : at(i * PRIZE_TIMINGS.itemGapMs, () => reveal(i)),
    );
    at(rewards.length * PRIZE_TIMINGS.itemGapMs, () => setStage('done'));
  }, [at, clearAll, emit, rewards]);

  // Show the dialog (modal where the browser can), play the drop and three wobbles, and hand
  // focus back when it goes.
  useEffect(() => {
    const dialog = dialogRef.current;
    const before = document.activeElement as HTMLElement | null;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (reduced) {
      emit('rewardOpen');
    } else {
      boxRef.current?.focus();
      let t = PRIZE_TIMINGS.dropMs;
      PRIZE_TIMINGS.wobbleMs.forEach((ms, i) => {
        at(t, () => {
          setWobble(i + 1);
          emit('rewardWobble');
          celebrate('prizeWobble', boxRef.current);
        });
        t += ms;
      });
      at(t, open);
    }
    return () => {
      clearAll();
      before?.focus?.();
    };
    // Runs once: the box opens when it mounts.
  }, []);

  // Each reward flies out of the box as it appears.
  useLayoutEffect(() => {
    if (reduced || shown === 0) return;
    const item = listRef.current?.children[shown - 1] as HTMLElement | undefined;
    const box = boxRef.current;
    if (!item || !box || typeof item.animate !== 'function') return;
    const b = box.getBoundingClientRect();
    const l = item.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (l.left + l.width / 2);
    const dy = b.top + b.height * 0.45 - (l.top + l.height / 2);
    item.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(.15) rotate(-20deg)`, opacity: 0 },
        { transform: 'translate(0, -14px) scale(1.12) rotate(4deg)', opacity: 1, offset: 0.7 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 620, easing: 'cubic-bezier(.34,1.56,.64,1)', fill: 'backwards' },
    );
  }, [shown, reduced]);

  useEffect(() => {
    if (stage === 'done') collectRef.current?.focus();
  }, [stage]);

  const close = useCallback(() => {
    clearAll();
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
    onClose();
  }, [clearAll, onClose]);

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    // Keep Tab inside the box.
    const stops = [boxRef.current, collectRef.current].filter((b): b is HTMLButtonElement => !!b);
    const at = stops.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : (at + 1) % stops.length;
    event.preventDefault();
    stops[next]?.focus();
  };

  const isOpen = stage !== 'closed';
  const heading = !isOpen
    ? 'A prize box!'
    : rewards.length === 1
      ? 'You earned a reward!'
      : `You earned ${rewards.length} rewards!`;
  const boxClass = [
    'prize-box__box',
    reduced ? (isOpen ? 'is-opened' : '') : isOpen ? 'is-open' : wobble === 0 ? 'is-dropping' : '',
    !reduced && stage === 'closed' && wobble > 0
      ? wobble === 3
        ? 'is-wobble-big'
        : `is-wobble-${wobble}`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <dialog
      ref={dialogRef}
      className="prize-box"
      aria-labelledby={headingId}
      onKeyDown={onKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <h2 id={headingId}>{heading}</h2>
      <p className="prize-box__hint">{isOpen ? '' : 'Tap the box to open it'}</p>
      <div className="prize-box__stage">
        <ul ref={listRef} className="prize-box__rewards" aria-live="polite">
          {rewards.slice(0, shown).map((reward) => {
            const reason = rewardReason(reward.id);
            return (
              <li
                key={reward.id}
                className={`prize-box__reward prize-box__reward--${reward.rarity}`}
              >
                <small>{itemWords(reward)}</small>
                <b>{reward.name}</b>
                {reason && <span>For: {reason}</span>}
              </li>
            );
          })}
        </ul>
        <button
          ref={boxRef}
          type="button"
          className={boxClass}
          aria-label={isOpen ? 'Prize box, open' : 'Open the prize box'}
          onClick={() => {
            if (stage === 'closed') open();
          }}
        >
          <PrizeBoxArt />
        </button>
      </div>
      {/* The reward's own tiered sound, once everything is out (U's reward sounds). */}
      {stage === 'done' && <RewardSound rewards={rewards} />}
      {stage === 'done' && (
        <button ref={collectRef} type="button" className="prize-box__collect" onClick={close}>
          Collect
        </button>
      )}
    </dialog>
  );
}

/** Original art: a den box with fox-ear knobs and a star latch (from the mockup). */
function PrizeBoxArt() {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <ellipse cx="100" cy="192" rx="70" ry="8" fill="rgba(0,0,0,.3)" />
      <g className="prize-box__body">
        <path
          d="M34 96 H166 V178 Q166 188 156 188 H44 Q34 188 34 178 Z"
          fill="var(--pz-box)"
          stroke="#1d1640"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M34 96 H70 V188 H44 Q34 188 34 178 Z" fill="rgba(255,255,255,.18)" />
        <rect
          x="88"
          y="96"
          width="24"
          height="92"
          fill="var(--pz-ribbon)"
          stroke="#1d1640"
          strokeWidth="4"
        />
        <path
          d="M48 112 l8 -8 M48 128 l18 -18"
          stroke="#fff"
          strokeWidth="5"
          strokeLinecap="round"
          opacity=".35"
        />
        <path
          d="M100 124 l5 10 11 1.5 -8 7.5 2 11 -10 -5.5 -10 5.5 2 -11 -8 -7.5 11 -1.5z"
          fill="#fff6b0"
          stroke="#1d1640"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>
      <g className="prize-box__lid">
        <path
          d="M58 70 L66 44 L80 66 Z M142 70 L134 44 L120 66 Z"
          fill="var(--pz-ribbon)"
          stroke="#1d1640"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <rect
          x="24"
          y="66"
          width="152"
          height="34"
          rx="9"
          fill="var(--pz-box)"
          stroke="#1d1640"
          strokeWidth="5"
        />
        <rect x="24" y="66" width="152" height="12" rx="6" fill="rgba(255,255,255,.22)" />
        <rect
          x="86"
          y="66"
          width="28"
          height="34"
          fill="var(--pz-ribbon)"
          stroke="#1d1640"
          strokeWidth="4"
        />
      </g>
    </svg>
  );
}
