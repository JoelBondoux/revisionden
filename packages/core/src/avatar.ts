/**
 * Layered avatar saved as a short code (see docs/PLAN.md "Avatar builder").
 *
 * Code format (version 1): the character "1" then two base-36 characters (0-9, a-z) per layer,
 * in the order of AVATAR_LAYERS. Each pair is the index of the chosen item in that layer of the
 * catalogue. Items can be locked behind a reward; a locked item is only valid once earned.
 */
export const AVATAR_LAYERS = [
  'skin',
  'eyes',
  'mouth',
  'facialHair',
  'hairStyle',
  'hairColour',
  'top',
  'topColour',
  'eyewear',
  'headwear',
  'heldItem',
  'backgroundColour',
  'pattern',
  'scene',
] as const;

export type AvatarLayer = (typeof AVATAR_LAYERS)[number];
export type AvatarChoices = Record<AvatarLayer, number>;

export interface AvatarItem {
  id: string;
  /** Reward id (see rewards.ts) that unlocks this item. Free when absent. */
  unlockedBy?: string;
}

export type AvatarCatalogue = Record<AvatarLayer, readonly AvatarItem[]>;

const free = (...ids: string[]): AvatarItem[] => ids.map((id) => ({ id }));
const locked = (id: string, unlockedBy: string): AvatarItem => ({ id, unlockedBy });

const COLOURS = [
  'white',
  'black',
  'navy',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'grey',
];

/**
 * The approved builder (mockup screen 16). Original art inspired by hobbies and games; nothing
 * copies a real game's characters or logos. First item in every layer is free; layers that can
 * be empty start with "none". Locked items show their reward in the builder.
 */
export const AVATAR_CATALOGUE: AvatarCatalogue = {
  skin: [
    ...free('skin-1', 'skin-2', 'skin-3', 'skin-4', 'skin-5', 'skin-6', 'skin-7', 'skin-8'),
    locked('alien', 'streak-100'),
    locked('robot', 'topics-mastered-10'),
  ],
  eyes: free(
    'eyes-round',
    'eyes-happy',
    'eyes-sleepy',
    'eyes-wink',
    'eyes-wide',
    'eyes-starry',
    'eyes-focused',
    'eyes-lashes',
    'eyes-side',
    'eyes-sparkle',
  ),
  mouth: free(
    'mouth-smile',
    'mouth-grin',
    'mouth-open',
    'mouth-flat',
    'mouth-tongue',
    'mouth-smirk',
    'mouth-wow',
    'mouth-teeth',
    'mouth-whistle',
    'mouth-braces',
  ),
  facialHair: free('none', 'stubble', 'moustache', 'goatee', 'full-beard'),
  hairStyle: free(
    'short',
    'buzz',
    'curly',
    'afro',
    'bob',
    'long',
    'ponytail',
    'bun',
    'braids',
    'bald',
    'spiky',
    'mohawk',
    'side-part',
    'quiff',
    'space-buns',
    'locs',
  ),
  hairColour: [
    ...free(
      'black',
      'dark-brown',
      'brown',
      'auburn',
      'ginger',
      'blonde',
      'grey',
      'white',
      'blue',
      'purple',
      'teal',
      'red',
    ),
    locked('neon-green', 'streak-7'),
    locked('hot-pink', 'streak-30'),
  ],
  top: [
    ...free(
      't-shirt',
      'hoodie',
      'jumper',
      'shirt',
      'sports-top',
      'jacket',
      'band-tee',
      'denim-jacket',
      'striped-top',
      'gilet',
    ),
    locked('gold-hoodie', 'assessment-all-targets'),
    locked('captain-shirt', 'mock-target-hit'),
    // Year chapter finales (docs/REWARDS.md); appended so saved avatar codes keep their items.
    locked('chapter-hoodie', 'chapter-1-finale'),
    locked('bomber-jacket', 'chapter-2-finale'),
    locked('gcse-finisher-jacket', 'chapter-3-finale'),
    locked('sixth-form-coat', 'chapter-4-finale'),
    locked('a-level-finisher-jacket', 'chapter-5-finale'),
  ],
  topColour: free(...COLOURS),
  eyewear: [
    ...free(
      'none',
      'round-glasses',
      'square-glasses',
      'sunglasses',
      'sport-goggles',
      'pixel-shades',
      'heart-glasses',
    ),
    locked('night-vision', 'weak-spots-10'),
    locked('laser-visor', 'full-past-paper'),
  ],
  headwear: [
    ...free(
      'none',
      'cap',
      'beanie',
      'headband',
      'bucket-hat',
      'headphones',
      'pixel-helmet',
      'fox-ears',
      'backwards-cap',
      'bandana',
    ),
    locked('crown', 'streak-100'),
    locked('dino-hood', 'gift-5-friends'),
    locked('bobble-hat', 'autumn-2-2026-2'),
    locked('explorer-hat', 'explorer-4'),
  ],
  heldItem: [
    ...free(
      'none',
      'guitar',
      'football',
      'skateboard',
      'controller',
      'pickaxe',
      'clapperboard',
      'popcorn',
      'microphone',
      'drumsticks',
    ),
    locked('trophy', 'league-top'),
    locked('dino-buddy', 'gift-3-days'),
    locked('pixel-sword', 'perfect-set'),
    locked('lantern', 'autumn-2-2026-5'),
    locked('magnifier', 'bug-hunter-3'),
    locked('quill', 'fact-checker-3'),
  ],
  backgroundColour: free(
    'sky',
    'mint',
    'sand',
    'lilac',
    'peach',
    'slate',
    'red',
    'orange',
    'yellow',
    'green',
    'blue',
    'pink',
  ),
  pattern: free('none', 'dots', 'stripes', 'zigzag', 'stars', 'checks', 'waves', 'pixels'),
  scene: [
    ...free('none', 'pitch', 'skate-park', 'gig-stage', 'pixel-hills', 'cinema', 'vinyl'),
    locked('jungle', 'starting-test'),
    locked('space', 'correct-25-in-a-row'),
    locked('rooftop', 'chapter-2-finale'),
    locked('frosty-night', 'autumn-2-2026-8'),
  ],
};

export const DEFAULT_AVATAR: AvatarChoices = Object.fromEntries(
  AVATAR_LAYERS.map((layer) => [layer, 0]),
) as AvatarChoices;

const VERSION = '1';
const WIDTH = 2;
const MAX_INDEX = 36 ** WIDTH - 1;
export const AVATAR_CODE_LENGTH = VERSION.length + AVATAR_LAYERS.length * WIDTH;

export class AvatarCodeError extends Error {
  override name = 'AvatarCodeError';
}

export function encodeAvatar(choices: AvatarChoices): string {
  const parts = AVATAR_LAYERS.map((layer) => {
    const index = choices[layer];
    if (!Number.isInteger(index) || index < 0 || index > MAX_INDEX) {
      throw new AvatarCodeError(`Avatar ${layer} must be a whole number from 0 to ${MAX_INDEX}`);
    }
    return index.toString(36).padStart(WIDTH, '0');
  });
  return VERSION + parts.join('');
}

export function decodeAvatar(code: string): AvatarChoices {
  if (code.length !== AVATAR_CODE_LENGTH) {
    throw new AvatarCodeError(`Avatar code must have length ${AVATAR_CODE_LENGTH}`);
  }
  if (!code.startsWith(VERSION)) throw new AvatarCodeError('Unknown avatar code version');
  if (!/^[0-9a-z]+$/.test(code)) throw new AvatarCodeError('Avatar code has an invalid character');
  const entries = AVATAR_LAYERS.map((layer, i) => {
    const start = VERSION.length + i * WIDTH;
    return [layer, parseInt(code.slice(start, start + WIDTH), 36)];
  });
  return Object.fromEntries(entries) as AvatarChoices;
}

export type AvatarProblem =
  | { layer: AvatarLayer; reason: 'unknown_item' }
  | { layer: AvatarLayer; reason: 'locked'; requires: string }
  | { layer: 'code'; reason: 'malformed' };

export type AvatarValidation = { ok: true } | { ok: false; problems: AvatarProblem[] };

/** Checks a code against the catalogue and the rewards the student has earned. */
export function validateAvatar(
  code: string,
  earnedRewardIds: readonly string[],
  catalogue: AvatarCatalogue = AVATAR_CATALOGUE,
): AvatarValidation {
  let choices: AvatarChoices;
  try {
    choices = decodeAvatar(code);
  } catch {
    return { ok: false, problems: [{ layer: 'code', reason: 'malformed' }] };
  }
  const earned = new Set(earnedRewardIds);
  const problems: AvatarProblem[] = [];
  for (const layer of AVATAR_LAYERS) {
    const item = catalogue[layer][choices[layer]];
    if (!item) problems.push({ layer, reason: 'unknown_item' });
    else if (item.unlockedBy && !earned.has(item.unlockedBy)) {
      problems.push({ layer, reason: 'locked', requires: item.unlockedBy });
    }
  }
  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}
