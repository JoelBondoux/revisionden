/**
 * Pip's outfits (J15b, owner direction 2026-11-26). Pip is dressed lightly for the current
 * subject: one item worn (a hat, glasses, a collar...) and, on bigger sizes, one prop and a faint
 * background tint. Pip is unisex: a small touch (a moustache, a bow, freckles, or nothing) rotates
 * by day, and is never tied to a subject or to the student. All art is original and code-drawn.
 */

export type OutfitItem =
  | 'pencil'
  | 'round-glasses'
  | 'goggles'
  | 'lab-collar'
  | 'leaf'
  | 'ruff'
  | 'explorer-hat'
  | 'beret'
  | 'headset'
  | 'bow-tie';

export type OutfitProp =
  | 'protractor'
  | 'magnet'
  | 'test-tube'
  | 'magnifier'
  | 'quill'
  | 'scroll'
  | 'croissant'
  | 'laptop'
  | 'mask'
  | 'clapperboard';

export interface Outfit {
  /** What the subject is, for the sheet and tests (never read out). */
  subject: string;
  item: OutfitItem | null;
  prop: OutfitProp | null;
  /** A faint background colour inside the ring. */
  tint: string;
}

export type UnisexTouch = 'none' | 'moustache' | 'bow' | 'freckles';

/** Plain Pip, for screens with no subject. */
export const PLAIN: Outfit = { subject: 'none', item: null, prop: null, tint: '#fff4d6' };

/** Which outfit each subject gets, matched on the subject id (`gcse-maths`, `a-level-physics`). */
const OUTFITS: readonly [RegExp, Outfit][] = [
  [/maths|further-math/, { subject: 'Maths', item: 'pencil', prop: 'protractor', tint: '#e3ebff' }],
  [/physics/, { subject: 'Physics', item: 'goggles', prop: 'magnet', tint: '#e6e0ff' }],
  [/chemistry/, { subject: 'Chemistry', item: 'lab-collar', prop: 'test-tube', tint: '#dff5f0' }],
  [/biology/, { subject: 'Biology', item: 'leaf', prop: 'magnifier', tint: '#e3f4e4' }],
  [
    /english-lit|literature/,
    { subject: 'English Literature', item: 'ruff', prop: 'quill', tint: '#f6ead8' },
  ],
  [/history/, { subject: 'History', item: 'explorer-hat', prop: 'scroll', tint: '#f3ead2' }],
  [/french/, { subject: 'French', item: 'beret', prop: 'croissant', tint: '#ffe8e3' }],
  [/computer/, { subject: 'Computer Science', item: 'headset', prop: 'laptop', tint: '#dff1ff' }],
  [/drama/, { subject: 'Drama', item: 'bow-tie', prop: 'mask', tint: '#f6e2f4' }],
  [
    /film/,
    { subject: 'Film Studies', item: 'round-glasses', prop: 'clapperboard', tint: '#ececec' },
  ],
];

/** Pip's outfit for a subject id (or name); plain Pip for anything else. */
export function outfitFor(subjectId: string | null | undefined): Outfit {
  if (!subjectId) return PLAIN;
  const key = subjectId.toLowerCase().replace(/\s+/g, '-');
  return OUTFITS.find(([pattern]) => pattern.test(key))?.[1] ?? PLAIN;
}

/** Half the days are plain; the rest rotate the three touches. */
const TOUCHES: readonly UnisexTouch[] = ['none', 'moustache', 'none', 'bow', 'none', 'freckles'];

/**
 * Today's unisex touch. It depends only on the date (and an optional seed, such as the session),
 * never on the subject or on who the student is.
 */
export function touchFor(day: string, seed = 0): UnisexTouch {
  let hash = seed;
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TOUCHES[hash % TOUCHES.length]!;
}
