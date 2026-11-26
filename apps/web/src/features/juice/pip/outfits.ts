/**
 * Pip's outfits (J15b, revised J15b-2 from the owner-approved all-themes mockup, 2026-11-26).
 * Pip dresses for the current subject: at most one worn item (a hat, glasses, a collar...) and one
 * prop he holds in front of his ring, on a faint disc tint. French, German and Spanish add a soft
 * wash of flag colours behind him. A gently-leaning look rotates by day and is never tied to a
 * subject or to the student: Pip is always just Pip. All art is original and code-drawn.
 */

export type OutfitItem =
  | 'round-glasses'
  | 'dark-glasses'
  | 'safety-specs'
  | 'goggles'
  | 'visor'
  | 'blue-pen'
  | 'leaf'
  | 'explorer-hat'
  | 'beret'
  | 'alpine-hat'
  | 'headset'
  | 'lab-collar'
  | 'bow-tie'
  | 'neckerchief';

export type OutfitProp =
  | 'calculator'
  | 'compass'
  | 'chart'
  | 'speech-bubble'
  | 'book'
  | 'magnifier'
  | 'test-tube'
  | 'magnet'
  | 'flask'
  | 'laptop'
  | 'scroll'
  | 'croissant'
  | 'pretzel'
  | 'guitar'
  | 'mask'
  | 'clapperboard';

export interface FlagWash {
  dir: 'vertical' | 'horizontal';
  /** Equal bands, first to last (left to right, or top to bottom). */
  colours: readonly string[];
}

export interface Outfit {
  /** What the subject is, for the sheet and tests (never read out). */
  subject: string;
  item: OutfitItem | null;
  prop: OutfitProp | null;
  /** A faint background colour inside the ring. */
  tint: string;
  flag?: FlagWash;
}

/** Items worn on the head; the beanie look gives way to a bandana when one of these is on. */
export const HATS: readonly OutfitItem[] = [
  'explorer-hat',
  'beret',
  'alpine-hat',
  'visor',
  'headset',
];

/** Plain Pip, for screens with no subject. */
export const PLAIN: Outfit = { subject: 'none', item: null, prop: null, tint: '#fff4d6' };

/** Which outfit each subject gets, matched on the subject id (`gcse-maths`, `a-level-physics`). */
const OUTFITS: readonly [RegExp, Outfit][] = [
  [
    /further-math/,
    { subject: 'Further Maths', item: 'round-glasses', prop: 'compass', tint: '#e8e2ff' },
  ],
  [/statistic/, { subject: 'Statistics', item: 'visor', prop: 'chart', tint: '#dff5ee' }],
  [/maths|mathematics/, { subject: 'Maths', item: null, prop: 'calculator', tint: '#e3ebff' }],
  [
    /english-lit|literature/,
    { subject: 'English Literature', item: null, prop: 'book', tint: '#f6ead8' },
  ],
  [
    /english/,
    { subject: 'English Language', item: 'blue-pen', prop: 'speech-bubble', tint: '#e6f0ff' },
  ],
  [
    /combined/,
    { subject: 'Combined Science', item: 'safety-specs', prop: 'flask', tint: '#e0f3ff' },
  ],
  [/physics/, { subject: 'Physics', item: 'goggles', prop: 'magnet', tint: '#e6e0ff' }],
  [/chemistry/, { subject: 'Chemistry', item: 'lab-collar', prop: 'test-tube', tint: '#dff5f0' }],
  [/biology/, { subject: 'Biology', item: 'leaf', prop: 'magnifier', tint: '#e3f4e4' }],
  [/computer/, { subject: 'Computer Science', item: 'headset', prop: 'laptop', tint: '#dff1ff' }],
  [/history/, { subject: 'History', item: 'explorer-hat', prop: 'scroll', tint: '#f3ead2' }],
  [
    /french/,
    {
      subject: 'French',
      item: 'beret',
      prop: 'croissant',
      tint: '#ffe8e3',
      flag: { dir: 'vertical', colours: ['#0055a4', '#ffffff', '#ef4135'] },
    },
  ],
  [
    /german/,
    {
      subject: 'German',
      item: 'alpine-hat',
      prop: 'pretzel',
      tint: '#e8f2e0',
      flag: { dir: 'horizontal', colours: ['#000000', '#dd0000', '#ffce00'] },
    },
  ],
  [
    /spanish/,
    {
      subject: 'Spanish',
      item: 'neckerchief',
      prop: 'guitar',
      tint: '#fff0dc',
      flag: { dir: 'horizontal', colours: ['#aa151b', '#f1bf00', '#f1bf00', '#aa151b'] },
    },
  ],
  [/drama/, { subject: 'Drama', item: 'bow-tie', prop: 'mask', tint: '#f6e2f4' }],
  [
    /film/,
    { subject: 'Film Studies', item: 'dark-glasses', prop: 'clapperboard', tint: '#ececec' },
  ],
];

/** Pip's outfit for a subject id (or name); plain Pip for anything else. */
export function outfitFor(subjectId: string | null | undefined): Outfit {
  if (!subjectId) return PLAIN;
  const key = subjectId.toLowerCase().replace(/\s+/g, '-');
  return OUTFITS.find(([pattern]) => pattern.test(key))?.[1] ?? PLAIN;
}

/**
 * Three gently-leaning looks, two versions each (owner, 2026-11-26): A a tuft or a tiny moustache;
 * B a bow with lashes, or a clip with a little blush; C a stud earring with freckles, or a beanie
 * (a bandana when he already wears a hat). No flags or symbols, and Pip keeps his name.
 */
export const LOOK_FAMILIES = ['a', 'b', 'c'] as const;
export type LookFamily = (typeof LOOK_FAMILIES)[number];
export interface PipLook {
  family: LookFamily;
  variant: 0 | 1;
}

/**
 * Today's look. It depends only on the date (YYYY-MM-DD): the family changes every day and the
 * version every three days, so all six come round within a week.
 */
export function lookFor(day: string): PipLook {
  const days = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const n = Number.isFinite(days) ? days : 0;
  return {
    family: LOOK_FAMILIES[((n % 3) + 3) % 3]!,
    variant: Math.floor(n / 3) % 2 === 0 ? 0 : 1,
  };
}
