import './particles.css';
import { useMemo } from 'react';
import { useSound } from '../../sound/SoundProvider';
import type { FeedbackEvent } from '../../sound/feedback/events';
import { BURST_EVENT, burstSoundDue } from './sound';
import {
  burstFor,
  fitToBudget,
  flavourFor,
  planBurst,
  shapeSvg,
  type BurstOptions,
  type CelebrateEvent,
} from './plan';

/**
 * Plays particle plans (J17). Callable from anywhere, not just React: it reads the active effect
 * style from the page (`data-effect-style`, set by EffectStyleProvider) and the device's
 * reduced-motion setting at the moment of the burst. Particles live in an `aria-hidden`,
 * click-through layer; inside an open `<dialog>` the layer goes in the dialog so it shows above it.
 */

let live = 0;
const timers = new Set<ReturnType<typeof setTimeout>>();

/** How many particles are flying right now. */
export function liveParticles(): number {
  return live;
}

/** Removes every particle at once (tests, and leaving a screen). */
export function resetParticles(): void {
  for (const t of timers) clearTimeout(t);
  timers.clear();
  for (const layer of document.querySelectorAll('.fx-layer')) layer.remove();
  live = 0;
  lastSound = null;
}

function reducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function layerFor(el: Element): HTMLElement {
  const host = el.closest('dialog') ?? document.body;
  const found = [...host.children].find((c) => c.classList.contains('fx-layer'));
  if (found) return found as HTMLElement;
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  host.appendChild(layer);
  return layer;
}

/** Plays keyframes, then removes the node; without Web Animations it just waits and removes. */
function play(node: HTMLElement, frames: Keyframe[], ms: number, easing: string, done: () => void) {
  const finish = () => {
    node.remove();
    done();
  };
  if (typeof node.animate === 'function') {
    const animation = node.animate(frames, { duration: ms, easing });
    animation.onfinish = finish;
    animation.oncancel = finish;
    return;
  }
  const t = setTimeout(() => {
    timers.delete(t);
    finish();
  }, ms);
  timers.add(t);
}

const nothing = () => undefined;

/** A burst of the active style's particles from the middle of an element. */
export function burstAt(el: Element | null | undefined, options: BurstOptions = {}): number {
  if (!el || typeof document === 'undefined' || reducedMotion()) return 0;
  const flavour = flavourFor(document.documentElement.dataset.effectStyle ?? '');
  const box = el.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const count = fitToBudget(Math.round(options.count ?? 16), live);
  const plan = planBurst(x, y, flavour, { ...options, count }, Math.random);
  const layer = layerFor(el);

  const ring = document.createElement('span');
  ring.className = 'fx-ring';
  ring.style.setProperty('--fx-ring', plan.ring.colour);
  layer.appendChild(ring);
  const at = `translate(${x - 10}px, ${y - 10}px)`;
  play(
    ring,
    [
      { transform: `${at} scale(.3)`, opacity: 0.9 },
      { transform: `${at} scale(${plan.ring.scale})`, opacity: 0 },
    ],
    450,
    'ease-out',
    nothing,
  );

  for (const p of plan.particles) {
    const node = document.createElement('span');
    node.className = 'fx-particle';
    node.dataset.shape = p.shape;
    node.style.setProperty('--fx-size', `${p.size}px`);
    // Safe: the shape and colour come only from the fixed table in plan.ts.
    node.innerHTML = shapeSvg(p.shape, p.colour);
    node.style.transform = p.frames[0]!.transform;
    layer.appendChild(node);
    live += 1;
    play(
      node,
      p.frames.map((f) => ({ ...f })),
      p.durationMs,
      'linear',
      () => {
        live = Math.max(0, live - 1);
      },
    );
  }

  if (plan.word) {
    const word = document.createElement('span');
    word.className = 'fx-word';
    word.textContent = plan.word;
    layer.appendChild(word);
    const w = (dy: number) => `translate(${x - 40}px, ${y + dy}px)`;
    play(
      word,
      [
        { transform: `${w(-30)} rotate(-12deg) scale(.2)`, opacity: 1 },
        { transform: `${w(-40)} rotate(-8deg) scale(1.15)`, opacity: 1, offset: 0.35 },
        { transform: `${w(-50)} rotate(-6deg) scale(1)`, opacity: 0 },
      ],
      900,
      'cubic-bezier(.34,1.56,.64,1)',
      nothing,
    );
  }
  return plan.particles.length;
}

/** The burst for a moment (a right answer grows with the combo). */
export function celebrate(
  event: CelebrateEvent,
  el: Element | null | undefined,
  { combo = 0 }: { combo?: number } = {},
): number {
  return burstAt(el, burstFor(event, { combo }));
}

export interface Celebrate {
  burstAt: typeof burstAt;
  celebrate: typeof celebrate;
}

let lastSound: number | null = null;

/** For tests: the burst sound to play, standing in for U8's `particleBurst`. */
export const burstSound = { event: BURST_EVENT };

/**
 * The burst calls for components, with the burst sound (at most once every 140 ms, and only when
 * something flies). `emit` and `now` can be swapped in tests.
 */
const clock = () => performance.now();

export function useCelebrate({
  emit,
  now = clock,
}: { emit?: (event: FeedbackEvent) => unknown; now?: () => number } = {}): Celebrate {
  const sound = useSound();
  const play = emit ?? sound.emit;
  return useMemo(() => {
    const withSound = (count: number) => {
      const t = now();
      const event = burstSound.event;
      if (event && count > 0 && burstSoundDue(t, lastSound)) {
        lastSound = t;
        play(event);
      }
      return count;
    };
    return {
      burstAt: (el, options) => withSound(burstAt(el, options)),
      celebrate: (event, el, options) => withSound(celebrate(event, el, options)),
    };
  }, [play, now]);
}
