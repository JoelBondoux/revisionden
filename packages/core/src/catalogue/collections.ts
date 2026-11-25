/**
 * Collections (see docs/REWARDS.md "Collections"). A set is a list of reward ids from any source;
 * earning every member unlocks the set's bonus reward (an epic item and a title for hobby sets,
 * a title for each season's set). Seasonal items come back through their season's set.
 */
import { CHAPTER_REWARDS } from './chapters';
import { LEVEL_REWARDS } from './levels';
import { MILESTONE_REWARDS } from './milestones';
import { SEASONS, SEASON_REWARDS } from './seasons';
import type { Collection, Reward, RewardItem } from './types';

const itemKey = (item: RewardItem) => ('text' in item ? item.text : item.id);
const SOURCES = [...LEVEL_REWARDS, ...CHAPTER_REWARDS, ...MILESTONE_REWARDS];

/** The id of the reward that gives this item; an unknown item makes a `missing:` id the validator reports. */
function giving(kind: RewardItem['kind'], key: string): string {
  const found = SOURCES.find((r) => r.items.some((i) => i.kind === kind && itemKey(i) === key));
  return found?.id ?? `missing:${kind}:${key}`;
}

const hobby = (
  id: string,
  name: string,
  members: string[],
  bonus: RewardItem,
  title: string,
): { collection: Collection; bonus: Reward } => ({
  collection: { id, name, members },
  bonus: {
    id: `${id}-complete`,
    name: `${name} complete`,
    rarity: 'epic',
    source: 'collection',
    target: { kind: 'collection', collectionId: id },
    items: [bonus, { kind: 'title', text: title }],
    giftDays: 0,
  },
});

const HOBBY_SETS = [
  hobby(
    'gig-kit',
    'Gig kit',
    [
      giving('theme', 'stage-lights'),
      giving('frame', 'amp-stack'),
      giving('title', 'Opening Act'),
      giving('pipOutfit', 'roadie'),
      giving('badge', 'practice-amp'),
    ],
    { kind: 'pipOutfit', id: 'frontfox' },
    'Gig Legend',
  ),
  hobby(
    'skate-crew',
    'Skate crew',
    [
      giving('theme', 'concrete-bowl'),
      giving('frame', 'grip-tape'),
      giving('title', 'Kickflip'),
      giving('pipOutfit', 'skater'),
      giving('title', 'Halfpipe'),
    ],
    { kind: 'frame', id: 'skate-crew' },
    'Skate Crew',
  ),
  hobby(
    'pitch-day',
    'Pitch day',
    [
      giving('theme', 'floodlights'),
      giving('frame', 'goal-net'),
      giving('title', 'Playmaker'),
      giving('pipOutfit', 'keeper'),
      giving('avatar', 'captain-shirt'),
      giving('avatar', 'trophy'),
    ],
    { kind: 'pipOutfit', id: 'match-day' },
    'Match Winner',
  ),
  hobby(
    'pixel-world',
    'Pixel world',
    [
      giving('theme', 'arcade'),
      giving('frame', 'pixel-border'),
      giving('title', 'Speedrunner'),
      giving('pipOutfit', 'pixel'),
      giving('avatar', 'pixel-sword'),
      giving('avatar', 'laser-visor'),
    ],
    { kind: 'frame', id: 'pixel-world' },
    'High Scorer',
  ),
  hobby(
    'dino-expedition',
    'Dino expedition',
    [
      giving('theme', 'jungle-canopy'),
      giving('frame', 'fossil'),
      giving('title', 'Fossil Hunter'),
      giving('pipOutfit', 'explorer'),
      giving('avatar', 'dino-hood'),
      giving('avatar', 'dino-buddy'),
      giving('avatar', 'jungle'),
    ],
    { kind: 'pipOutfit', id: 'palaeontologist' },
    'Dino Expert',
  ),
  hobby(
    'cinema-night',
    'Cinema night',
    [
      giving('theme', 'silver-screen'),
      giving('frame', 'film-strip'),
      giving('title', "Director's Cut"),
      giving('pipOutfit', 'usher'),
      giving('frame', 'clapper'),
    ],
    { kind: 'frame', id: 'premiere' },
    'Film Buff',
  ),
];

const SEASON_SETS = SEASONS.map((s) => ({
  collection: {
    id: `season-${s.id}`,
    name: `${s.name} collection`,
    members: SEASON_REWARDS.filter(
      (r) => r.target.kind === 'season' && r.target.seasonId === s.id,
    ).map((r) => r.id),
  },
  bonus: {
    id: `season-${s.id}-complete`,
    name: `${s.name} collector`,
    rarity: 'rare',
    source: 'collection',
    target: { kind: 'collection', collectionId: `season-${s.id}` },
    items: [{ kind: 'title', text: `${s.name} Collector` }],
    giftDays: 0,
  } satisfies Reward,
}));

export const COLLECTIONS: readonly Collection[] = [...HOBBY_SETS, ...SEASON_SETS].map(
  (s) => s.collection,
);
export const COLLECTION_REWARDS: readonly Reward[] = [...HOBBY_SETS, ...SEASON_SETS].map(
  (s) => s.bonus,
);
