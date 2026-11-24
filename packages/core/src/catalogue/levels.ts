/**
 * Level rewards: something small at every level from 2 to 99 (a colour theme, a frame or a
 * title, in turn), a rare Pip outfit every 10th level, an epic set at level 100 and gold frames
 * for the five prestige stars. Ids are `level-<n>` and `prestige-<n>`.
 */
import { MAX_LEVEL, MAX_PRESTIGE_STARS } from '../levels';
import type { Rarity, Reward, RewardItem } from './types';

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** Colour themes, in unlock order. */
export const LEVEL_THEMES = [
  'Mint',
  'Sunset',
  'Ocean',
  'Stage lights',
  'Lime',
  'Concrete bowl',
  'Coral',
  'Floodlights',
  'Lavender',
  'Arcade',
  'Sand',
  'Jungle canopy',
  'Ruby',
  'Silver screen',
  'Teal',
  'Neon night',
  'Peach',
  'Storm',
  'Forest',
  'Vinyl black',
  'Sky',
  'Bubblegum',
  'Amber',
  'Glacier',
  'Cherry',
  'Moss',
  'Indigo',
  'Copper',
  'Aurora',
  'Midnight',
];

/** Profile frames, in unlock order. */
export const LEVEL_FRAMES = [
  'Simple ring',
  'Dotted',
  'Amp stack',
  'Double line',
  'Grip tape',
  'Hexagon',
  'Goal net',
  'Zigzag',
  'Pixel border',
  'Wave',
  'Fossil',
  'Starburst',
  'Film strip',
  'Bolt',
  'Cassette',
  'Chalk',
  'Leaf',
  'Circuit',
  'Ticket stub',
  'Comet',
  'Brick',
  'Sticker',
  'Rope',
  'Prism',
  'Equaliser',
  'Compass',
  'Spray paint',
  'Orbit',
  'Laurel',
  'Crystal',
];

/** Profile titles, in unlock order. */
export const LEVEL_TITLES = [
  'Fresh Start',
  'Quick Learner',
  'Opening Act',
  'Note Taker',
  'Kickflip',
  'Steady Hand',
  'Playmaker',
  'Problem Solver',
  'Speedrunner',
  'Focus Mode',
  'Fossil Hunter',
  'Deep Thinker',
  "Director's Cut",
  'Comeback Kid',
  'Headliner',
  'Night Owl Reformed',
  'Grinder',
  'Mapmaker',
  'Formula Fan',
  'Quiz Whiz',
  'Encore',
  'Brainstormer',
  'Top Scorer',
  'Fact Finder',
  'Marathoner',
  'Puzzle Master',
  'Lorekeeper',
  'Strategist',
  'Trailblazer',
];

/** Pip the fox outfits for levels 10, 20, ... 90. */
export const LEVEL_PIP_OUTFITS = [
  'Roadie',
  'Skater',
  'Keeper',
  'Pixel',
  'Explorer',
  'Usher',
  'Astronaut',
  'Scientist',
  'Rock star',
];

const reward = (id: string, name: string, rarity: Rarity, level: number, items: RewardItem[]) =>
  ({
    id,
    name,
    rarity,
    source: 'level',
    target: { kind: 'stat', stat: 'level', atLeast: level },
    items,
    giftDays: 0,
  }) satisfies Reward;

function smallReward(level: number, index: number): Reward {
  const i = Math.floor(index / 3);
  switch (index % 3) {
    case 0: {
      const name = LEVEL_THEMES[i]!;
      return reward(`level-${level}`, `${name} theme`, 'common', level, [
        { kind: 'theme', id: slug(name) },
      ]);
    }
    case 1: {
      const name = LEVEL_FRAMES[i]!;
      return reward(`level-${level}`, `${name} frame`, 'common', level, [
        { kind: 'frame', id: slug(name) },
      ]);
    }
    default: {
      const name = LEVEL_TITLES[i]!;
      return reward(`level-${level}`, `"${name}" title`, 'common', level, [
        { kind: 'title', text: name },
      ]);
    }
  }
}

function buildLevelRewards(): Reward[] {
  const out: Reward[] = [];
  let small = 0;
  for (let level = 2; level < MAX_LEVEL; level++) {
    if (level % 10 === 0) {
      const name = LEVEL_PIP_OUTFITS[level / 10 - 1]!;
      out.push(
        reward(`level-${level}`, `Pip ${name.toLowerCase()} outfit`, 'rare', level, [
          { kind: 'pipOutfit', id: slug(name) },
        ]),
      );
    } else {
      out.push(smallReward(level, small++));
    }
  }
  out.push(
    reward(`level-${MAX_LEVEL}`, 'Level 100: Centurion', 'legendary', MAX_LEVEL, [
      { kind: 'frame', id: 'centurion' },
      { kind: 'title', text: 'Centurion' },
    ]),
  );
  for (let star = 1; star <= MAX_PRESTIGE_STARS; star++) {
    out.push({
      id: `prestige-${star}`,
      name: `Prestige star ${star}`,
      rarity: star >= 4 ? 'legendary' : 'epic',
      source: 'level',
      target: { kind: 'stat', stat: 'prestigeStars', atLeast: star },
      items: [{ kind: 'frame', id: `gold-${star}` }],
      giftDays: 0,
    });
  }
  return out;
}

export const LEVEL_REWARDS: readonly Reward[] = buildLevelRewards();
