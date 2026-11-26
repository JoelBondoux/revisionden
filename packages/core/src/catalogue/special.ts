/**
 * One-off special rewards (R5). They stay out of every track and teaser: the overview shows
 * them only once earned. Title words for them live in title-words.ts.
 */
import type { Reward } from './types';

export const SPECIAL_REWARDS: readonly Reward[] = [
  {
    id: 'founding-tester',
    name: 'Founding Tester',
    rarity: 'legendary',
    source: 'special',
    target: { kind: 'stat', stat: 'foundingTester', atLeast: 1 },
    items: [{ kind: 'badge', id: 'founding-tester' }],
    giftDays: 0,
  },
];
