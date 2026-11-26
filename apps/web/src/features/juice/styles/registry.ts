/**
 * Effect styles (J10): one look-and-feel for the game-feel moments, the Home screen and Rewards,
 * active at a time. A style is an entry here plus one stylesheet scoped to
 * `:root[data-effect-style='<id>']` (see doodle-diary.css). Doodle Diary is the default and is
 * always available; the others unlock as rewards (J10b, J10d).
 */
export const EFFECT_STYLE_IDS = [
  'doodle-diary',
  'sticker-book',
  'pop-burst',
  'garden-grow',
  'starlight',
  'comic-pop',
  'pixel-arcade',
  'petal-glow',
  'turbo-drive',
  'rainbow-parade',
] as const;
export type EffectStyleId = (typeof EFFECT_STYLE_IDS)[number];

export interface EffectStyle {
  readonly id: EffectStyleId;
  readonly name: string;
  /** One plain sentence for the style picker. */
  readonly description: string;
  /** How to unlock it (none for the default); the rewards catalogue does the unlocking. */
  readonly unlock?: string;
  /** Three colours for the picker's little preview. */
  readonly swatch: readonly [string, string, string];
}

export const EFFECT_STYLES: Readonly<Record<EffectStyleId, EffectStyle>> = {
  'doodle-diary': {
    id: 'doodle-diary',
    name: 'Doodle Diary',
    description:
      'A diary full of pen doodles: sketched boxes, scribbled colouring-in and red-pen marks on your wins.',
    swatch: ['#fdfbf4', '#2f5bd3', '#c8382e'],
  },
  'sticker-book': {
    id: 'sticker-book',
    name: 'Sticker Book',
    description:
      'Warm and hand-made: wins are stickers slapped onto the page, with paper confetti and a little wobble.',
    unlock: 'Reach level 3',
    swatch: ['#fffdf7', '#ffd166', '#c93a2b'],
  },
  'pop-burst': {
    id: 'pop-burst',
    name: 'Pop Burst',
    description: 'Loud and bouncy: jelly squash, gold coins of XP and big confetti bursts.',
    unlock: 'Reach level 5',
    swatch: ['#7b4dff', '#ff7a59', '#ffe066'],
  },
  starlight: {
    id: 'starlight',
    name: 'Starlight',
    description:
      'Glowing and dreamy: progress lights up like stars, and rewards arrive in a swirl of sparkles.',
    unlock: 'Master 10 topics',
    swatch: ['#241a6b', '#4be3ff', '#ff7ad9'],
  },
  'garden-grow': {
    id: 'garden-grow',
    name: 'Garden Grow',
    description:
      'Soft and calm: rewards bloom from seeds, petals drift and your map is a garden path.',
    unlock: 'Master 5 topics in a subject',
    swatch: ['#dff4ff', '#3fae5a', '#ff8fb1'],
  },
  'comic-pop': {
    id: 'comic-pop',
    name: 'Comic Pop',
    description: 'Bold outlines, halftone dots and word bubbles: every win lands with a POW!',
    unlock: 'Reach level 20',
    swatch: ['#ffe14d', '#ff3b3b', '#1e9bff'],
  },
  'pixel-arcade': {
    id: 'pixel-arcade',
    name: 'Pixel Arcade',
    description: 'Retro arcade with chunky pixel art, chiptune blips and treasure chests.',
    unlock: 'Reach level 40',
    swatch: ['#0a0820', '#39ff88', '#ff4fd8'],
  },
  // J16 (U7, owner-approved 2026-11-26): three styles unlocked together by the starting test,
  // never labelled by gender.
  'petal-glow': {
    id: 'petal-glow',
    name: 'Petal Glow',
    description:
      'Soft and sparkly: petals drift, buttons glow and every win blooms with a sparkle.',
    unlock: 'Finish your starting test',
    swatch: ['#fff3f9', '#ff7eb6', '#b79cff'],
  },
  'turbo-drive': {
    id: 'turbo-drive',
    name: 'Turbo Drive',
    description: 'Fast and bold: racing stripes, speed streaks and wins that zoom over the line.',
    unlock: 'Finish your starting test',
    swatch: ['#15171d', '#ff7a1a', '#22d3ee'],
  },
  'rainbow-parade': {
    id: 'rainbow-parade',
    name: 'Rainbow Parade',
    description:
      'Bright and joyful: a parade of rainbow colour, with twinkling glitter on every win.',
    unlock: 'Finish your starting test',
    swatch: ['#fffaf2', '#732982', '#ffed00'],
  },
};

/**
 * Styles the owner has approved and the rewards catalogue already unlocks but that are still
 * being built. The picker shows them locked, with how to unlock them. Empty since J10c.
 */
export interface ComingSoonStyle extends Omit<EffectStyle, 'id'> {
  readonly id: string;
}

export const COMING_SOON_STYLES: readonly ComingSoonStyle[] = [];

export const DEFAULT_EFFECT_STYLE: EffectStyleId = 'doodle-diary';

/** Where this device remembers the chosen style. */
export const EFFECT_STYLE_KEY = 'revisionden.effectStyle';

export interface StyleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function isEffectStyleId(value: unknown): value is EffectStyleId {
  return (EFFECT_STYLE_IDS as readonly unknown[]).includes(value);
}

/** The style to show: the saved one if it exists and is available, otherwise the default. */
export function chooseEffectStyle(
  saved: unknown,
  unlocked: readonly EffectStyleId[],
): EffectStyleId {
  if (!isEffectStyleId(saved)) return DEFAULT_EFFECT_STYLE;
  return saved === DEFAULT_EFFECT_STYLE || unlocked.includes(saved) ? saved : DEFAULT_EFFECT_STYLE;
}

/** This device's chosen style; anything missing, unknown or unreadable gives the default. */
export function loadEffectStyle(storage: StyleStorage | null): EffectStyleId {
  try {
    const saved = storage?.getItem(EFFECT_STYLE_KEY);
    return isEffectStyleId(saved) ? saved : DEFAULT_EFFECT_STYLE;
  } catch {
    return DEFAULT_EFFECT_STYLE;
  }
}

/** Saves the choice on this device. Storage errors are ignored: the choice still applies. */
export function saveEffectStyle(storage: StyleStorage | null, id: EffectStyleId): void {
  try {
    storage?.setItem(EFFECT_STYLE_KEY, id);
  } catch {
    // Private browsing or blocked site data: keep going without saving.
  }
}

/** Applies the style as a data attribute on the root element (the style sheets read it). */
export function applyEffectStyle(root: HTMLElement, id: EffectStyleId): void {
  root.dataset.effectStyle = id;
}
