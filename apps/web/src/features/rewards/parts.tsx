import type { RewardCardResponse } from '@revisionden/core';
import { Pill, type PillTone } from '../../components';

const RARITY_TONE: Record<RewardCardResponse['rarity'], PillTone> = {
  common: 'neutral',
  rare: 'primary',
  epic: 'streak',
  legendary: 'gold',
};

const KIND_WORDS: Record<RewardCardResponse['items'][number]['kind'], string> = {
  avatar: 'Avatar item',
  frame: 'Frame',
  title: 'Title',
  theme: 'Colour theme',
  pipOutfit: 'Pip outfit',
  badge: 'Badge',
};

export function RarityPill({ rarity }: { rarity: RewardCardResponse['rarity'] }) {
  return <Pill tone={RARITY_TONE[rarity]}>{rarity[0]!.toUpperCase() + rarity.slice(1)}</Pill>;
}

/** What a reward gives, in words, for example "Frame + Title". */
export const itemWords = (card: RewardCardResponse) =>
  [...new Set(card.items.map((i) => KIND_WORDS[i.kind]))].join(' + ');

export const longDate = (day: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
