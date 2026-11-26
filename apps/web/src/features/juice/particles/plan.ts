/**
 * Themed particle bursts (J17), ported from the owner-approved mockup
 * (docs/mockups/all-themes-pip.html, `FX` and `burst`). Everything here is pure: randomness is
 * injected and the result is a plan of Web Animations keyframes that touch only transform and
 * opacity. `ParticleLayer` plays the plans.
 */

import type { Random } from '../logic';

export type ShapeId =
  | 'squiggle'
  | 'loop'
  | 'star5-outline'
  | 'star5-sticker'
  | 'heart'
  | 'coin'
  | 'star4'
  | 'dot'
  | 'petal'
  | 'leaf'
  | 'pixel'
  | 'streak'
  | 'confetti'
  | 'glint';

/** One kind of particle a style throws, and how often (weights are relative within a style). */
export interface ShapePick {
  readonly shape: ShapeId;
  readonly colours: readonly string[];
  readonly weight: number;
}

export interface Flavour {
  readonly picks: readonly ShapePick[];
  /** Particle size in px. */
  readonly size: readonly [number, number];
  /** Downward pull in px/s² (negative drifts up). */
  readonly gravity: number;
  /** Launch speed in px/s. */
  readonly speed: readonly [number, number];
  /** Most it spins, in degrees either way. */
  readonly spin: number;
  /** Side-to-side sway in px (petals and leaves). */
  readonly sway?: number;
  readonly durationMs: readonly [number, number];
  /** Colour of the ring flash at the centre. */
  readonly ring: string;
  /** Comic words for big moments. */
  readonly words?: readonly string[];
  /** Points each particle along its path (speed streaks). */
  readonly align?: boolean;
  /** Blinks on and off as it flies (glitter). */
  readonly twinkle?: boolean;
}

const RAINBOW = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#24408e', '#732982'] as const;

/** Every style's particles. Keyed by effect style id; styles not in the app yet are ready too. */
export const FLAVOURS: Readonly<Record<string, Flavour>> = {
  'doodle-diary': {
    picks: (['squiggle', 'loop', 'star5-outline'] as const).map((shape) => ({
      shape,
      colours: ['#2f5fd0', '#e0453a', '#2b2a3a', '#f2b400'],
      weight: 1,
    })),
    size: [14, 22],
    gravity: 260,
    speed: [140, 300],
    spin: 200,
    durationMs: [900, 1300],
    ring: '#2f5fd0',
  },
  'sticker-book': {
    picks: (['star5-sticker', 'heart'] as const).map((shape) => ({
      shape,
      colours: ['#ff6b6b', '#1fbeaa', '#ffd166', '#9b6bff'],
      weight: 1,
    })),
    size: [16, 24],
    gravity: 420,
    speed: [180, 360],
    spin: 120,
    durationMs: [900, 1200],
    ring: '#ffffff',
  },
  'pop-burst': {
    picks: [
      { shape: 'coin', colours: ['#ffc83d'], weight: 7 },
      { shape: 'star4', colours: ['#fff7c2'], weight: 3 },
    ],
    size: [14, 22],
    gravity: 700,
    speed: [260, 460],
    spin: 360,
    durationMs: [800, 1100],
    ring: '#ffe066',
  },
  starlight: {
    picks: [{ shape: 'star4', colours: ['#fff6b0', '#4be3ff', '#ffffff', '#c7b8ff'], weight: 1 }],
    size: [10, 20],
    gravity: -40,
    speed: [60, 190],
    spin: 90,
    durationMs: [1100, 1700],
    ring: '#4be3ff',
  },
  'comic-pop': {
    picks: [{ shape: 'dot', colours: ['#ff3b30', '#1e9bff', '#ffe14d', '#111111'], weight: 1 }],
    size: [6, 12],
    gravity: 300,
    speed: [220, 420],
    spin: 0,
    durationMs: [600, 900],
    ring: '#111111',
    words: ['POW!', 'ZAP!', 'WOW!', 'BAM!'],
  },
  'garden-grow': {
    picks: [
      { shape: 'petal', colours: ['#ff8fb1', '#ffd1e0', '#ffffff', '#ffd166'], weight: 6 },
      { shape: 'leaf', colours: ['#3fae5a', '#7ccf6b'], weight: 4 },
    ],
    size: [12, 18],
    gravity: 90,
    speed: [100, 230],
    spin: 260,
    sway: 28,
    durationMs: [1300, 1900],
    ring: '#3fae5a',
  },
  'pixel-arcade': {
    // Smooth movement (no steps()): the owner asked for pixels that glide, not judder.
    picks: [{ shape: 'pixel', colours: ['#39ff88', '#ff3cac', '#ffd23f', '#4be3ff'], weight: 1 }],
    size: [6, 10],
    gravity: 520,
    speed: [180, 380],
    spin: 0,
    durationMs: [700, 1000],
    ring: '#39ff88',
  },
  'petal-glow': {
    picks: [
      { shape: 'petal', colours: ['#ffb6d8', '#d9c4ff', '#ffe07a', '#bff0e3'], weight: 65 },
      { shape: 'star4', colours: ['#ffffff'], weight: 35 },
    ],
    size: [10, 18],
    gravity: 40,
    speed: [80, 200],
    spin: 180,
    sway: 20,
    durationMs: [1300, 1900],
    ring: '#ffb6d8',
  },
  'turbo-drive': {
    picks: [{ shape: 'streak', colours: ['#ff7a1a', '#22d3ee', '#ffffff'], weight: 1 }],
    size: [18, 30],
    gravity: 0,
    speed: [320, 560],
    spin: 0,
    align: true,
    durationMs: [450, 700],
    ring: '#22d3ee',
  },
  'rainbow-parade': {
    picks: [
      { shape: 'glint', colours: RAINBOW, weight: 55 },
      { shape: 'confetti', colours: RAINBOW, weight: 45 },
    ],
    size: [8, 16],
    gravity: 300,
    speed: [180, 380],
    spin: 540,
    twinkle: true,
    durationMs: [1100, 1600],
    ring: '#732982',
  },
};

const DEFAULT_FLAVOUR = 'doodle-diary';

/** The particles for an effect style; Doodle Diary's for one we do not know. */
export function flavourFor(styleId: string): Flavour {
  return FLAVOURS[styleId] ?? FLAVOURS[DEFAULT_FLAVOUR]!;
}

/** The SVG for one particle. Colours only ever come from the table above. */
export function shapeSvg(shape: ShapeId, c: string): string {
  const v = 'viewBox="-10 -10 20 20"';
  const star5 = 'M0 -9l2.6 5.6 6.1.7-4.5 4.2 1.2 6L0 14.5l-5.4 3 1.2-6-4.5-4.2 6.1-.7z';
  switch (shape) {
    case 'squiggle':
      return `<svg ${v}><path d="M-8 2 Q-5 -6 -2 2 T4 2 T9 -2" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/></svg>`;
    case 'loop':
      return `<svg ${v}><path d="M-7 0 C-7 -8 6 -8 6 0 S-4 8 -4 0" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
    case 'star5-outline':
      return `<svg ${v}><path d="${star5}" transform="scale(.8)" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/></svg>`;
    case 'star5-sticker':
      return `<svg ${v}><path d="${star5}" transform="scale(.8)" fill="${c}" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
    case 'heart':
      return `<svg ${v}><path d="M0 7 C-9 0 -8 -8 -3 -8 C-1 -8 0 -6 0 -5 C0 -6 1 -8 3 -8 C8 -8 9 0 0 7Z" fill="${c}" stroke="#fff" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
    case 'coin':
      return `<svg ${v}><circle r="9" fill="${c}" stroke="#b7791f" stroke-width="2"/><circle r="5.5" fill="none" stroke="#fff3b0" stroke-width="1.6"/></svg>`;
    case 'star4':
      return `<svg ${v}><path d="M0 -10 C1 -2 2 -1 10 0 C2 1 1 2 0 10 C-1 2 -2 1 -10 0 C-2 -1 -1 -2 0 -10Z" fill="${c}" style="filter:drop-shadow(0 0 3px ${c})"/></svg>`;
    case 'dot':
      return `<svg ${v}><circle r="7" fill="${c}"/></svg>`;
    case 'petal':
      return `<svg ${v}><path d="M0 -9 C6 -4 6 4 0 9 C-6 4 -6 -4 0 -9Z" fill="${c}"/></svg>`;
    case 'leaf':
      return `<svg ${v}><path d="M-8 6 C-8 -4 0 -9 9 -8 C8 2 2 8 -8 6Z" fill="${c}"/><path d="M-7 5 L6 -6" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>`;
    case 'pixel':
      return `<svg viewBox="0 0 10 10" shape-rendering="crispEdges"><rect width="10" height="10" fill="${c}"/></svg>`;
    case 'streak':
      return `<svg viewBox="-10 -3 20 6"><rect x="-10" y="-1.6" width="20" height="3.2" rx="1.6" fill="${c}"/></svg>`;
    case 'confetti':
      return `<svg viewBox="-6 -10 12 20"><rect x="-4" y="-8" width="8" height="16" rx="1.5" fill="${c}"/></svg>`;
    case 'glint':
      return `<svg ${v}><path d="M0 -10 L2 -2 L10 0 L2 2 L0 10 L-2 2 L-10 0 L-2 -2Z" fill="${c}" stroke="#fff" stroke-width="1.2" style="filter:drop-shadow(0 0 2px ${c})"/></svg>`;
  }
}

/** Most particles in one burst. */
export const BURST_CAP = 30;
/** Most particles alive on screen at once; bursts past this are trimmed or dropped. */
export const MAX_LIVE_PARTICLES = 90;

/** How many of a burst's particles fit, given how many are already flying. */
export function fitToBudget(requested: number, live: number): number {
  return Math.max(0, Math.min(requested, MAX_LIVE_PARTICLES - live));
}

export interface BurstOptions {
  count?: number;
  /** 1 is a normal burst; bigger flies further, faster, with a bigger ring. */
  power?: number;
  /** Ask for a comic word (styles that have them show one anyway from power 1.3). */
  word?: boolean;
}

export interface Frame {
  offset: number;
  transform: string;
  opacity: number;
}

export interface PlannedParticle {
  shape: ShapeId;
  colour: string;
  size: number;
  durationMs: number;
  frames: Frame[];
}

export interface BurstPlan {
  ring: { colour: string; scale: number; x: number; y: number };
  particles: PlannedParticle[];
  word: string | null;
}

const between = (random: Random, [lo, hi]: readonly [number, number]) => lo + random() * (hi - lo);
const pickOne = <T>(random: Random, list: readonly T[]): T =>
  list[Math.min(list.length - 1, Math.floor(random() * list.length))]!;
const round = (n: number) => Math.round(n * 10) / 10;

function pickShape(random: Random, picks: readonly ShapePick[]): ShapePick {
  const total = picks.reduce((sum, p) => sum + p.weight, 0);
  let roll = random() * total;
  for (const pick of picks) {
    roll -= pick.weight;
    if (roll < 0) return pick;
  }
  return picks.at(-1)!;
}

const STEADY = [0, 0.1, 0.35, 0.65, 1];
const TWINKLE = [0, 0.1, 0.22, 0.35, 0.5, 0.65, 0.8, 1];

/** A burst of a style's particles at (x, y), in the layer's px. */
export function planBurst(
  x: number,
  y: number,
  flavour: Flavour,
  { count = 16, power = 1, word = false }: BurstOptions,
  random: Random,
): BurstPlan {
  const n = Math.max(0, Math.min(Math.round(count), BURST_CAP));
  const particles = Array.from({ length: n }, (_, i): PlannedParticle => {
    const pick = pickShape(random, flavour.picks);
    const colour = pickOne(random, pick.colours);
    const size = Math.round(between(random, flavour.size));
    const angle = (i / n) * Math.PI * 2 + (random() - 0.5) * 0.6;
    const v = between(random, flavour.speed) * power;
    const t = between(random, flavour.durationMs) / 1000;
    const dx = Math.cos(angle) * v * t * 0.6;
    const dy = Math.sin(angle) * v * t * 0.6;
    const rot = flavour.align ? (angle * 180) / Math.PI : (random() * 2 - 1) * flavour.spin;
    const sway = flavour.sway ?? 0;
    const at = (k: number) => {
      const ease = 1 - (1 - k) ** 2;
      const px = x + dx * ease + Math.sin(k * 6) * sway - size / 2;
      const py = y + dy * ease + 0.5 * flavour.gravity * (k * t) ** 2 - size / 2;
      const turn = flavour.align ? rot : rot * k;
      const scale = k < 0.1 ? 0.4 + k * 6 : 1;
      return `translate(${round(px)}px, ${round(py)}px) rotate(${round(turn)}deg) scale(${round(scale)})`;
    };
    const keys = flavour.twinkle ? TWINKLE : STEADY;
    const frames = keys.map((k, j) => {
      const fade = k >= 1 ? 0 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const blink = flavour.twinkle && j % 2 ? 0.35 : 1;
      return { offset: k, transform: at(k), opacity: round(fade * blink) || 0 };
    });
    return { shape: pick.shape, colour, size, durationMs: Math.round(t * 1000), frames };
  });
  const showWord = flavour.words && (word || power >= 1.3);
  return {
    ring: { colour: flavour.ring, scale: 4 * power, x, y },
    particles,
    word: showWord ? pickOne(random, flavour.words!) : null,
  };
}

/** The moments that burst (docs/GAME_FEEL.md, J17). */
export type CelebrateEvent =
  | 'correct'
  | 'goal'
  | 'levelUp'
  | 'topicComplete'
  | 'rewardUnlock'
  | 'styleUnlock'
  | 'prizeWobble'
  | 'prizeOpen'
  | 'prizeItem';

/** How big each moment's burst is (the mockup's numbers). */
export function burstFor(
  event: CelebrateEvent,
  { combo = 0 }: { combo?: number } = {},
): BurstOptions {
  switch (event) {
    case 'correct':
      return combo >= 4
        ? { count: 8 + combo * 2, power: 0.8 + combo * 0.1 }
        : { count: 18, power: 1 };
    case 'goal':
      return { count: 22, power: 1.2 };
    case 'levelUp':
      return { count: 28, power: 1.5, word: true };
    case 'topicComplete':
      return { count: 22, power: 1.2, word: true };
    case 'rewardUnlock':
      return { count: 30, power: 1.6, word: true };
    case 'styleUnlock':
      return { count: 12, power: 0.8 };
    case 'prizeWobble':
      return { count: 6, power: 0.5 };
    case 'prizeOpen':
      return { count: 26, power: 1.4, word: true };
    case 'prizeItem':
      return { count: 12, power: 0.7 };
  }
}
