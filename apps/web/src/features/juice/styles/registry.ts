/**
 * Effect styles (J10): one look-and-feel for the game-feel moments, the Home screen and Rewards,
 * active at a time. A style is an entry here plus one stylesheet scoped to
 * `:root[data-effect-style='<id>']` (see sticker-book.css). Sticker Book is the default and is
 * always available; other styles unlock as rewards (J10b).
 */
export const EFFECT_STYLE_IDS = ['sticker-book', 'pop-burst', 'starlight'] as const;
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
  'sticker-book': {
    id: 'sticker-book',
    name: 'Sticker Book',
    description:
      'Warm and hand-made: wins are stickers slapped onto the page, with paper confetti and a little wobble.',
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
};

export const DEFAULT_EFFECT_STYLE: EffectStyleId = 'sticker-book';

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
