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

const COLOURS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'grey'];

/** First item in every layer is free; layers that can be empty start with "none". */
export const AVATAR_CATALOGUE: AvatarCatalogue = {
  skin: free('skin-1', 'skin-2', 'skin-3', 'skin-4', 'skin-5', 'skin-6'),
  eyes: free('eyes-round', 'eyes-happy', 'eyes-sleepy', 'eyes-wink', 'eyes-wide', 'eyes-starry'),
  mouth: free('mouth-smile', 'mouth-grin', 'mouth-open', 'mouth-flat', 'mouth-tongue'),
  facialHair: free('none', 'stubble', 'moustache', 'short-beard', 'full-beard'),
  hairStyle: [
    ...free('short', 'buzz', 'curly', 'afro', 'bob', 'long', 'ponytail', 'bun', 'braids', 'bald'),
    locked('mohawk', 'streak-30'),
  ],
  hairColour: [
    ...free('black', 'dark-brown', 'brown', 'auburn', 'ginger', 'blonde', 'grey', 'white'),
    locked('rainbow', 'streak-100'),
  ],
  top: [
    ...free('t-shirt', 'hoodie', 'jumper', 'shirt', 'sports-top', 'jacket'),
    locked('lab-coat', 'full-past-paper'),
    locked('cape', 'league-top'),
  ],
  topColour: free('white', 'black', 'navy', ...COLOURS),
  eyewear: [
    ...free('none', 'round-glasses', 'square-glasses', 'sunglasses'),
    locked('star-glasses', 'perfect-set'),
  ],
  headwear: [
    ...free('none', 'cap', 'beanie', 'headband'),
    locked('graduation-cap', 'mock-target-hit'),
    locked('crown', 'assessment-all-targets'),
  ],
  heldItem: [
    ...free('none', 'book', 'pencil'),
    locked('calculator', 'starting-test'),
    locked('magnifier', 'weak-spots-10'),
    locked('trophy', 'topics-mastered-10'),
    locked('gift-box', 'gift-3-days'),
  ],
  backgroundColour: free('sky', 'mint', 'sand', 'lilac', 'peach', 'slate', ...COLOURS),
  pattern: [...free('none', 'dots', 'stripes', 'zigzag'), locked('flames', 'streak-7')],
  scene: [
    ...free('none', 'library', 'park'),
    locked('space', 'correct-25-in-a-row'),
    locked('friendship-garden', 'gift-5-friends'),
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
