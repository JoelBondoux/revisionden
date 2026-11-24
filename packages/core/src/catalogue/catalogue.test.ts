import { describe, expect, it } from 'vitest';
import { AVATAR_CATALOGUE, type AvatarCatalogue } from '../avatar';
import { CHAPTERS, CHAPTER_STEPS } from '../chapters';
import { MAX_LEVEL } from '../levels';
import {
  COLLECTIONS,
  REWARDS,
  SEASONS,
  rarityShares,
  validateCatalogue,
  type Collection,
  type Reward,
  type Season,
} from './index';

const statReward = (id: string, over: Partial<Reward> = {}): Reward => ({
  id,
  name: id,
  rarity: 'common',
  source: 'milestone',
  target: { kind: 'stat', stat: 'bestStreak', atLeast: 1 },
  items: [{ kind: 'badge', id }],
  giftDays: 0,
  ...over,
});

const check = (
  rewards: Reward[],
  opts: { collections?: Collection[]; seasons?: Season[]; avatar?: AvatarCatalogue } = {},
) =>
  validateCatalogue(rewards, {
    collections: opts.collections ?? [],
    seasons: opts.seasons ?? [],
    avatar: opts.avatar ?? { ...emptyAvatar },
  });

const emptyAvatar = Object.fromEntries(
  Object.keys(AVATAR_CATALOGUE).map((layer) => [layer, [{ id: 'free' }]]),
) as unknown as AvatarCatalogue;

describe('the real catalogue', () => {
  it('passes every validator check', () => {
    expect(
      validateCatalogue(REWARDS, {
        collections: COLLECTIONS,
        seasons: SEASONS,
        avatar: AVATAR_CATALOGUE,
      }),
    ).toEqual([]);
  });

  it('keeps the 14 original reward ids so earned rewards stay earned', () => {
    const ids = new Set(REWARDS.map((r) => r.id));
    for (const id of [
      'streak-7',
      'streak-30',
      'streak-100',
      'mock-target-hit',
      'assessment-all-targets',
      'full-past-paper',
      'weak-spots-10',
      'topics-mastered-10',
      'perfect-set',
      'gift-3-days',
      'gift-5-friends',
      'league-top',
      'starting-test',
      'correct-25-in-a-row',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('has a reward for every level from 2 to 100 and five prestige stars', () => {
    const levels = REWARDS.filter((r) => r.target.kind === 'stat' && r.target.stat === 'level').map(
      (r) => (r.target as { atLeast: number }).atLeast,
    );
    expect(levels).toEqual(Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 2));
    expect(REWARDS.filter((r) => r.id.startsWith('prestige-'))).toHaveLength(5);
  });

  it('makes every 10th level rare or better', () => {
    for (const r of REWARDS.filter((r) => /^level-\d+0$/.test(r.id))) {
      expect(r.rarity).not.toBe('common');
    }
  });

  it('has a 30-step track for each of the five year chapters', () => {
    for (const chapter of CHAPTERS) {
      const steps = REWARDS.filter((r) => r.id.startsWith(`chapter-${chapter.number}-`));
      expect(steps).toHaveLength(CHAPTER_STEPS);
      expect(steps.every((r) => r.source === 'chapter')).toBe(true);
    }
  });

  it('gives the GCSE and A-Level finisher sets when the last exam is sat', () => {
    const finale = (n: number) => REWARDS.find((r) => r.id === `chapter-${n}-finale`)!;
    expect(finale(3).target).toEqual({ kind: 'stat', stat: 'gcseFinished', atLeast: 1 });
    expect(finale(5).target).toEqual({ kind: 'stat', stat: 'aLevelFinished', atLeast: 1 });
    expect(finale(3).rarity).toBe('legendary');
    expect(finale(5).rarity).toBe('legendary');
  });

  it('includes every milestone ladder step from REWARDS.md', () => {
    const steps = (stat: string) =>
      REWARDS.filter(
        (r) => r.source === 'milestone' && r.target.kind === 'stat' && r.target.stat === stat,
      ).map((r) => (r.target as { atLeast: number }).atLeast);
    expect(steps('bestStreak')).toEqual([7, 30, 60, 100, 180, 365, 500, 750, 1000]);
    expect(steps('correctAnswers')).toEqual([100, 500, 1000, 2500, 5000, 10000, 25000]);
    expect(steps('bestSubjectTopicsMastered')).toEqual([5, 10, 25]);
    expect(steps('bestSubjectMasteryPercent')).toEqual([50, 75, 100]);
    expect(steps('weakSpotsFixed')).toEqual([10, 25, 50, 100, 250]);
    expect(steps('fullPastPapers')).toEqual([1, 5, 10, 25, 50, 100]);
    expect(steps('flashcardsReviewed')).toEqual([500, 2500, 10000]);
    expect(steps('daysGifted')).toEqual([3, 10, 25]);
    expect(steps('friendsGiftedTo')).toEqual([5, 15]);
    expect(steps('weeksTopOfLeague')).toEqual([1, 5, 20]);
    expect(steps('gcseExamsSat')).toEqual([1]);
    expect(steps('gcseFinished')).toEqual([1]);
    expect(steps('aLevelExamsSat')).toEqual([1]);
    expect(steps('aLevelFinished')).toEqual([1]);
    expect(steps('mocksWithTargetHit')).toEqual([1]);
    expect(steps('assessmentsWithAllTargetsHit')).toEqual([1]);
    expect(steps('mocksAboveTarget')).toEqual([1]);
  });

  it('grants gift days with streak milestones: 7→1, 30→2, 100→3, 365→5, 1,000→10', () => {
    const gifts = Object.fromEntries(
      REWARDS.filter((r) => r.giftDays > 0).map((r) => [r.id, r.giftDays]),
    );
    expect(gifts).toEqual({
      'streak-7': 1,
      'streak-30': 2,
      'streak-100': 3,
      'streak-365': 5,
      'streak-1000': 10,
    });
  });

  it('makes the 1,000-day streak and Subject master legendary', () => {
    expect(REWARDS.find((r) => r.id === 'streak-1000')!.rarity).toBe('legendary');
    expect(REWARDS.find((r) => r.id === 'subject-master')!.rarity).toBe('legendary');
  });

  it('has the six hobby collections from REWARDS.md, each with a bonus item and a title', () => {
    for (const name of [
      'Gig kit',
      'Skate crew',
      'Pitch day',
      'Pixel world',
      'Dino expedition',
      'Cinema night',
    ]) {
      const set = COLLECTIONS.find((c) => c.name === name)!;
      expect(set.members.length).toBeGreaterThanOrEqual(4);
      const bonus = REWARDS.filter(
        (r) => r.target.kind === 'collection' && r.target.collectionId === set.id,
      );
      expect(bonus.flatMap((r) => r.items.map((i) => i.kind))).toContain('title');
      expect(bonus.flatMap((r) => r.items).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('has a drop of 8 to 12 items for each term of the 2026/27 school year', () => {
    expect(SEASONS).toHaveLength(6);
    for (const season of SEASONS) {
      const items = REWARDS.filter(
        (r) => r.target.kind === 'season' && r.target.seasonId === season.id,
      );
      expect(items.length).toBeGreaterThanOrEqual(8);
      expect(items.length).toBeLessThanOrEqual(12);
    }
  });

  it('brings every missed seasonal item back a year later and inside a collection', () => {
    for (const season of SEASONS) {
      expect(season.rerelease.start > season.window.end).toBe(true);
      const ids = REWARDS.filter(
        (r) => r.target.kind === 'season' && r.target.seasonId === season.id,
      ).map((r) => r.id);
      const inSet = COLLECTIONS.find((c) => ids.every((id) => c.members.includes(id)));
      expect(inSet).toBeDefined();
    }
  });

  it('rewards exam-season consistency (goal days), not cramming', () => {
    const summer = SEASONS.find((s) => s.id === 'summer-1-2027')!;
    expect(summer.measure).toBe('goalDays');
  });

  it('roughly matches the rarity shares in REWARDS.md (50/30/15/5, within 6 points)', () => {
    const shares = rarityShares(REWARDS);
    expect(Math.abs(shares.common - 50)).toBeLessThanOrEqual(6);
    expect(Math.abs(shares.rare - 30)).toBeLessThanOrEqual(6);
    expect(Math.abs(shares.epic - 15)).toBeLessThanOrEqual(6);
    expect(Math.abs(shares.legendary - 5)).toBeLessThanOrEqual(6);
    expect(shares.legendary).toBeGreaterThan(0);
  });
});

describe('validateCatalogue', () => {
  it('finds duplicate ids', () => {
    expect(check([statReward('a'), statReward('a')])).toContain('a: duplicate id');
  });

  it('finds empty names and rewards with no items', () => {
    expect(check([statReward('a', { name: ' ' })])).toContain('a: needs a name');
    expect(check([statReward('a', { items: [] })])).toContain('a: needs at least one item');
  });

  it('finds unknown stats and unreachable targets', () => {
    expect(
      check([statReward('a', { target: { kind: 'stat', stat: 'minutes' as never, atLeast: 1 } })]),
    ).toContain('a: unknown stat minutes');
    expect(
      check([statReward('a', { target: { kind: 'stat', stat: 'level', atLeast: 101 } })]),
    ).toContain('a: level target 101 can never be reached (max 100)');
    expect(
      check([statReward('a', { target: { kind: 'stat', stat: 'bestStreak', atLeast: 0 } })]),
    ).toContain('a: target must be a whole number of at least 1');
  });

  it('finds bad gift days', () => {
    expect(check([statReward('a', { giftDays: -1 })])).toContain(
      'a: gift days must be a whole number of at least 0',
    );
  });

  it('finds collections that are unknown, empty, or contain missing or bonus rewards', () => {
    const bonus = statReward('bonus', { target: { kind: 'collection', collectionId: 'set' } });
    expect(check([bonus])).toContain('bonus: unknown collection set');
    expect(
      check([statReward('a'), bonus], {
        collections: [{ id: 'set', name: 'Set', members: ['a', 'ghost', 'bonus'] }],
      }),
    ).toEqual(
      expect.arrayContaining(['set: unknown member ghost', 'set: contains its own bonus bonus']),
    );
    expect(check([bonus], { collections: [{ id: 'set', name: 'Set', members: [] }] })).toContain(
      'set: has no members',
    );
  });

  it('finds seasons that are unknown or have windows in the wrong order', () => {
    const drop = statReward('drop', { target: { kind: 'season', seasonId: 's', atLeast: 1 } });
    expect(check([drop])).toContain('drop: unknown season s');
    const season: Season = {
      id: 's',
      name: 'S',
      window: { start: '2026-12-01', end: '2026-11-01' },
      rerelease: { start: '2026-10-01', end: '2026-10-02' },
      measure: 'goalDays',
      challenge: 'x',
    };
    expect(check([drop], { seasons: [season] })).toEqual(
      expect.arrayContaining([
        's: window ends before it starts',
        's: re-release must come after the window',
      ]),
    );
  });

  it('only lets avatar items unlock from the reward that locks them, and every locked item has one', () => {
    const avatar = {
      ...emptyAvatar,
      top: [{ id: 'free' }, { id: 'cape', unlockedBy: 'a' }, { id: 'orphan', unlockedBy: 'gone' }],
    } as AvatarCatalogue;
    const problems = check(
      [
        statReward('a', { items: [{ kind: 'avatar', layer: 'top', id: 'cape' }] }),
        statReward('b', { items: [{ kind: 'avatar', layer: 'top', id: 'free' }] }),
        statReward('c', { items: [{ kind: 'avatar', layer: 'top', id: 'nothing' }] }),
      ],
      { avatar },
    );
    expect(problems).toEqual(
      expect.arrayContaining([
        'b: avatar item top:free is not locked by b',
        'c: avatar item top:nothing is not in the avatar catalogue',
        'avatar item top:orphan is locked by gone, which does not unlock it',
      ]),
    );
    expect(problems.some((p) => p.startsWith('a:'))).toBe(false);
  });
});

describe('rarityShares', () => {
  it('gives each rarity as a percentage of all rewards', () => {
    expect(
      rarityShares([
        statReward('a'),
        statReward('b', { rarity: 'rare' }),
        statReward('c', { rarity: 'rare' }),
        statReward('d', { rarity: 'legendary' }),
      ]),
    ).toEqual({ common: 25, rare: 50, epic: 0, legendary: 25 });
    expect(rarityShares([])).toEqual({ common: 0, rare: 0, epic: 0, legendary: 0 });
  });
});
