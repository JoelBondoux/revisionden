import {
  AVATAR_CATALOGUE,
  AVATAR_LAYERS,
  REWARDS,
  type AvatarChoices,
  type AvatarItem,
  type AvatarLayer,
  type Rng,
} from '@revisionden/core';

export interface AvatarTab {
  id: string;
  label: string;
  sections: { layer: AvatarLayer; label: string }[];
}

/** Builder tabs from the approved design (mockup screen 16). */
export const AVATAR_TABS: AvatarTab[] = [
  {
    id: 'face',
    label: 'Face',
    sections: [
      { layer: 'skin', label: 'Skin' },
      { layer: 'eyes', label: 'Eyes' },
      { layer: 'mouth', label: 'Mouth' },
      { layer: 'facialHair', label: 'Facial hair' },
    ],
  },
  {
    id: 'hair',
    label: 'Hair',
    sections: [
      { layer: 'hairStyle', label: 'Style' },
      { layer: 'hairColour', label: 'Colour' },
    ],
  },
  {
    id: 'top',
    label: 'Top',
    sections: [
      { layer: 'top', label: 'Top' },
      { layer: 'topColour', label: 'Colour' },
    ],
  },
  { id: 'eyewear', label: 'Eyewear', sections: [{ layer: 'eyewear', label: 'Eyewear' }] },
  { id: 'headwear', label: 'Headwear', sections: [{ layer: 'headwear', label: 'Headwear' }] },
  { id: 'holding', label: 'Holding', sections: [{ layer: 'heldItem', label: 'Holding' }] },
  {
    id: 'background',
    label: 'Background',
    sections: [
      { layer: 'scene', label: 'Scene' },
      { layer: 'backgroundColour', label: 'Colour' },
      { layer: 'pattern', label: 'Pattern' },
    ],
  },
];

/** Plain words for an item id: "skate-park" → "Skate park", "eyes-wink" → "Wink". */
export function itemLabel(id: string): string {
  const words = id.replace(/^(eyes|mouth)-/, '').split('-');
  const text = id === 't-shirt' ? 'T-shirt' : words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Unlock: 100-day streak" for a locked item, from the rewards catalogue. */
export function lockLabel(item: AvatarItem): string | undefined {
  if (!item.unlockedBy) return undefined;
  const reward = REWARDS.find((r) => r.id === item.unlockedBy);
  return `Unlock: ${reward?.name ?? item.unlockedBy}`;
}

export function isAvailable(item: AvatarItem, earned: readonly string[]): boolean {
  return !item.unlockedBy || earned.includes(item.unlockedBy);
}

/** A random avatar that uses only items the student can wear. */
export function shuffleAvatar(rng: Rng, earned: readonly string[] = []): AvatarChoices {
  const entries = AVATAR_LAYERS.map((layer) => {
    const open = AVATAR_CATALOGUE[layer]
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => isAvailable(item, earned));
    return [layer, open[Math.floor(rng() * open.length)]!.index];
  });
  return Object.fromEntries(entries) as AvatarChoices;
}
