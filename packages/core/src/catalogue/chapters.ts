/**
 * Year chapter tracks (see docs/REWARDS.md "Year chapters"). Each chapter has 29 steps (CHAPTER_STEPS - 1), one every
 * CHAPTER_STEP_XP of chapter XP, and a finale. Steps 10, 20 and 25 are epic Pip outfits, other
 * even steps are rare. Ids are `chapter-<n>-<step>` and `chapter-<n>-finale`.
 */
import { CHAPTERS, CHAPTER_FULL_XP, CHAPTER_STEP_XP, type ChapterNumber } from '../chapters';
import type { Rarity, Reward, RewardItem, StatKey, UnlockTarget } from './types';

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** Step names per chapter, steps 1 to 29. Steps 10, 20 and 25 are Pip outfits. */
const STEP_NAMES: Record<ChapterNumber, readonly string[]> = {
  1: [
    'Pencil case',
    'Fresh notebook',
    'Locker',
    'New Starter',
    'Highlighter',
    'School bus',
    'Paper plane',
    'First Lesson',
    'Sticky notes',
    'Pip new kit',
    'Timetable',
    'Lunch break',
    'Doodle',
    'Bright Spark',
    'Calculator',
    'Bookworm',
    'Ruler',
    'Group project',
    'Science lab',
    'Pip lab coat',
    'Library card',
    'Recorder',
    'Sketchbook',
    'Curious Mind',
    'Pip backpacker',
    'Field trip',
    'Gold star',
    'Report day',
    'On the Way',
  ],
  2: [
    'Practice amp',
    'Mock timetable',
    'Knee pads',
    'Rising Star',
    'Training cones',
    'Revision cards',
    'Pixel heart',
    'Mock Ready',
    'Mixtape',
    'Pip bassist',
    'Mind map',
    'Halfpipe',
    'Floodlit pitch',
    'Level Up',
    'Clapper',
    'Game save',
    'Setlist',
    'Past paper',
    'Trophy shelf',
    'Pip referee',
    'Night bus',
    'Graph paper',
    'Encore',
    'Hard Worker',
    'Pip director',
    'Mock results',
    'Retro console',
    'Big screen',
    'Built Different',
  ],
  3: [
    'Exam pen',
    'Countdown',
    'Focus playlist',
    'Final Push',
    'Flash deck',
    'Clear desk',
    'Water bottle',
    'Exam Ready',
    'Quiet corner',
    'Pip study hood',
    'Timer',
    'Formula sheet',
    'Calm breath',
    'Locked In',
    'Mark scheme',
    'Spare pencil',
    'Wall chart',
    'Practice hall',
    'Seat number',
    'Pip champion',
    'Last mock',
    'Highlighter set',
    'Revision den',
    'Clutch',
    'Pip captain',
    'Leavers hoodie',
    'Signed shirt',
    'Prom ticket',
    'Nearly There',
  ],
  4: [
    'Lanyard',
    'Free period',
    'Study booth',
    'Sixth Former',
    'Coffee cup',
    'Laptop sticker',
    'Common room',
    'Big Ideas',
    'Notebook stack',
    'Pip scholar',
    'Bike lock',
    'Lecture notes',
    'Open day',
    'Independent',
    'Vinyl shelf',
    'Late bus',
    'Reading list',
    'Debate club',
    'Lab report',
    'Pip skate coach',
    'Gig ticket',
    'Essay plan',
    'Film club',
    'Deep Diver',
    'Pip DJ',
    'UCAS draft',
    'Skyline',
    'Campus map',
    'Next Chapter',
  ],
  5: [
    'Final timetable',
    'Personal statement',
    'Offer letter',
    'Senior',
    'Revision cave',
    'Study playlist',
    'Mentor badge',
    'Unstoppable',
    'Coffee refill',
    'Pip graduate',
    'Prize shelf',
    'Final mocks',
    'Index cards',
    'Mastermind',
    'Exam hall',
    'Library late',
    'Leaving card',
    'Results day',
    'Yearbook',
    'Pip legend',
    'Last lesson',
    'Signed hoodie',
    'Road trip',
    'Finisher',
    'Pip headliner',
    'Firework',
    'Open road',
    'Fanfare',
    'Hall of Fame',
  ],
};

const KIND_CYCLE = ['badge', 'theme', 'frame', 'title'] as const;
const EPIC_STEPS = new Set([10, 20, 25]);

function stepRarity(step: number): Rarity {
  if (EPIC_STEPS.has(step)) return 'epic';
  return step % 2 === 0 ? 'rare' : 'common';
}

function stepItem(name: string, step: number): RewardItem {
  if (EPIC_STEPS.has(step)) return { kind: 'pipOutfit', id: slug(name.replace(/^Pip /, '')) };
  const kind = KIND_CYCLE[(step - 1) % KIND_CYCLE.length]!;
  return kind === 'title' ? { kind, text: name } : { kind, id: slug(name) };
}

const chapterStat = (n: ChapterNumber) => `chapter${n}Xp` as StatKey;

interface Finale {
  name: string;
  rarity: Rarity;
  target: UnlockTarget;
  items: RewardItem[];
}

const FINALES: Record<ChapterNumber, Finale> = {
  1: {
    name: 'Chapter 1 finale: badge and hoodie',
    rarity: 'epic',
    target: { kind: 'stat', stat: 'chapter1Xp', atLeast: CHAPTER_FULL_XP },
    items: [
      { kind: 'badge', id: 'chapter-1' },
      { kind: 'avatar', layer: 'top', id: 'chapter-hoodie' },
    ],
  },
  2: {
    name: 'Chapter 2 finale: bomber jacket and rooftop scene',
    rarity: 'epic',
    target: { kind: 'stat', stat: 'chapter2Xp', atLeast: CHAPTER_FULL_XP },
    items: [
      { kind: 'avatar', layer: 'top', id: 'bomber-jacket' },
      { kind: 'avatar', layer: 'scene', id: 'rooftop' },
    ],
  },
  3: {
    name: 'GCSE finisher set',
    rarity: 'legendary',
    target: { kind: 'stat', stat: 'gcseFinished', atLeast: 1 },
    items: [
      { kind: 'avatar', layer: 'top', id: 'gcse-finisher-jacket' },
      { kind: 'frame', id: 'gcse-finisher' },
      { kind: 'title', text: 'GCSE Finisher' },
    ],
  },
  4: {
    name: 'Chapter 4 finale: sixth-form wardrobe',
    rarity: 'epic',
    target: { kind: 'stat', stat: 'chapter4Xp', atLeast: CHAPTER_FULL_XP },
    items: [
      { kind: 'avatar', layer: 'top', id: 'sixth-form-coat' },
      { kind: 'title', text: 'Sixth-Form Style' },
    ],
  },
  5: {
    name: 'A-Level finisher set',
    rarity: 'legendary',
    target: { kind: 'stat', stat: 'aLevelFinished', atLeast: 1 },
    items: [
      { kind: 'avatar', layer: 'top', id: 'a-level-finisher-jacket' },
      { kind: 'frame', id: 'a-level-finisher' },
      { kind: 'title', text: 'A-Level Finisher' },
    ],
  },
};

function buildChapterRewards(): Reward[] {
  return CHAPTERS.flatMap(({ number }) => {
    const steps: Reward[] = STEP_NAMES[number].map((name, i) => {
      const step = i + 1;
      return {
        id: `chapter-${number}-${step}`,
        name,
        rarity: stepRarity(step),
        source: 'chapter',
        target: { kind: 'stat', stat: chapterStat(number), atLeast: step * CHAPTER_STEP_XP },
        items: [stepItem(name, step)],
        giftDays: 0,
      };
    });
    const finale = FINALES[number];
    steps.push({ id: `chapter-${number}-finale`, source: 'chapter', giftDays: 0, ...finale });
    return steps;
  });
}

export const CHAPTER_REWARDS: readonly Reward[] = buildChapterRewards();
