import {
  AVATAR_CATALOGUE,
  DEFAULT_AVATAR,
  encodeAvatar,
  type AvatarChoices,
  type AvatarLayer,
} from '@revisionden/core';

/**
 * Three starting looks for a new child. Only the avatar code is ever saved, never which look was
 * picked, so nothing about gender is stored. Every item is free (no rewards needed).
 */
export type StarterId = 'boy' | 'girl' | 'neutral';

const pick = (layer: AvatarLayer, id: string): number => {
  const index = AVATAR_CATALOGUE[layer].findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`No ${layer} item called ${id}`);
  return index;
};

const look = (items: Partial<Record<AvatarLayer, string>>): AvatarChoices => {
  const choices = { ...DEFAULT_AVATAR };
  for (const [layer, id] of Object.entries(items) as [AvatarLayer, string][]) {
    choices[layer] = pick(layer, id);
  }
  return choices;
};

export const STARTER_LOOKS: { id: StarterId; label: string; choices: AvatarChoices }[] = [
  {
    id: 'boy',
    label: 'Boy',
    choices: look({
      skin: 'skin-3',
      hairStyle: 'short',
      hairColour: 'brown',
      top: 'hoodie',
      topColour: 'blue',
      backgroundColour: 'sky',
    }),
  },
  {
    id: 'girl',
    label: 'Girl',
    choices: look({
      skin: 'skin-3',
      hairStyle: 'long',
      hairColour: 'brown',
      top: 't-shirt',
      topColour: 'purple',
      backgroundColour: 'lilac',
    }),
  },
  {
    id: 'neutral',
    label: 'Neutral',
    choices: look({
      skin: 'skin-3',
      hairStyle: 'curly',
      hairColour: 'dark-brown',
      top: 'jumper',
      topColour: 'teal',
      backgroundColour: 'mint',
    }),
  },
];

export function starterCode(id: StarterId): string {
  return encodeAvatar(STARTER_LOOKS.find((s) => s.id === id)!.choices);
}
