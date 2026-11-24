import { describe, expect, it } from 'vitest';
import { CHAPTER_STEP_XP, CHAPTER_FULL_XP } from './chapters';
import { PRESTIGE_XP, xpForLevel } from './levels';
import { DAILY_REWARD_XP_CAP } from './reward-xp';
import {
  COLLECTIONS,
  REWARDS,
  SEASONS,
  evaluateRewards,
  giftDaysFor,
  progressionStats,
  rewardProgress,
  rewardsOverview,
  type Reward,
  type RewardStats,
} from './rewards';

const now = new Date('2026-11-24T12:00:00Z');
const ids = (stats: Partial<RewardStats>, earned: string[] = []) =>
  evaluateRewards(stats, earned, REWARDS, { now }).map((r) => r.id);
const byId = (id: string) => REWARDS.find((r) => r.id === id)!;

describe('evaluateRewards: the original 14 rewards', () => {
  it('unlocks streak rewards at 7, 30 and 100 days', () => {
    expect(ids({ bestStreak: 6 })).toEqual([]);
    expect(ids({ bestStreak: 7 })).toEqual(['streak-7']);
    expect(ids({ bestStreak: 30 }, ['streak-7'])).toEqual(['streak-30']);
    expect(ids({ bestStreak: 100 }, ['streak-7', 'streak-30', 'streak-60'])).toEqual([
      'streak-100',
    ]);
  });

  it('unlocks grade, practice, friendship, competition and early-win rewards', () => {
    expect(ids({ mocksWithTargetHit: 1 })).toEqual(['mock-target-hit']);
    expect(ids({ assessmentsWithAllTargetsHit: 1 })).toEqual(['assessment-all-targets']);
    expect(ids({ fullPastPapers: 1 })).toEqual(['full-past-paper']);
    expect(ids({ weakSpotsFixed: 9 })).toEqual([]);
    expect(ids({ weakSpotsFixed: 10 })).toEqual(['weak-spots-10']);
    expect(ids({ topicsMastered: 10 })).toEqual(['topics-mastered-10']);
    expect(ids({ perfectSets: 1 })).toEqual(['perfect-set']);
    expect(ids({ daysGifted: 3, friendsGiftedTo: 1 })).toEqual(['gift-3-days']);
    expect(ids({ daysGifted: 5, friendsGiftedTo: 5 }, ['gift-3-days'])).toEqual(['gift-5-friends']);
    expect(ids({ weeksTopOfLeague: 1 })).toEqual(['league-top']);
    expect(ids({ startingTestsCompleted: 1 })).toEqual(['starting-test']);
    expect(ids({ bestCorrectRun: 25 })).toEqual(['correct-25-in-a-row']);
  });

  it('returns several rewards at once and never one already earned', () => {
    expect(ids({ bestStreak: 40, perfectSets: 2 })).toEqual([
      'streak-7',
      'streak-30',
      'perfect-set',
    ]);
    expect(ids({ bestStreak: 40 }, ['streak-7', 'streak-30'])).toEqual([]);
  });

  it('gives gift days only with streak milestones', () => {
    expect(giftDaysFor(REWARDS.filter((r) => r.id.startsWith('streak-')))).toBe(21);
    expect(giftDaysFor(REWARDS.filter((r) => !r.id.startsWith('streak-')))).toBe(0);
  });
});

describe('evaluateRewards: levels, chapters and milestones', () => {
  it('unlocks one reward per level reached', () => {
    expect(ids({ level: 3 })).toEqual(['level-2', 'level-3']);
    expect(ids({ level: 3 }, ['level-2', 'level-3'])).toEqual([]);
  });

  it("unlocks chapter steps from that chapter's XP only", () => {
    expect(ids({ chapter2Xp: CHAPTER_STEP_XP * 2 })).toEqual(['chapter-2-1', 'chapter-2-2']);
    expect(ids({ chapter1Xp: CHAPTER_STEP_XP - 1 })).toEqual([]);
  });

  it('unlocks each target type exactly once, even when evaluated again', () => {
    const stats = { level: 12, bestStreak: 120, correctAnswers: 600, chapter1Xp: 2000 };
    const first = ids(stats);
    expect(new Set(first).size).toBe(first.length);
    expect(ids(stats, first)).toEqual([]);
  });
});

describe('evaluateRewards: collections', () => {
  const gig = COLLECTIONS.find((c) => c.id === 'gig-kit')!;

  it('unlocks the set bonus once every member is earned', () => {
    const allButOne = gig.members.slice(1);
    expect(ids({}, allButOne)).not.toContain('gig-kit-complete');
    expect(ids({}, [...gig.members])).toEqual(['gig-kit-complete']);
  });

  it('counts members earned in the same evaluation', () => {
    const missing = gig.members[0]!;
    const stat = byId(missing).target as { stat: keyof RewardStats; atLeast: number };
    const got = ids({ [stat.stat]: stat.atLeast }, gig.members.slice(1));
    expect(got).toContain(missing);
    expect(got).toContain('gig-kit-complete');
  });
});

describe('evaluateRewards: seasonal drops', () => {
  const autumn2 = SEASONS.find((s) => s.id === 'autumn-2-2026')!;

  it('unlocks drop items by the season challenge inside the term window', () => {
    const got = evaluateRewards({}, [], REWARDS, {
      now,
      seasonProgress: { 'autumn-2-2026': 50 },
    }).map((r) => r.id);
    expect(got).toEqual(['autumn-2-2026-1', 'autumn-2-2026-2']);
  });

  it('does not unlock outside the window or without progress', () => {
    const after = new Date('2027-03-01T12:00:00Z');
    expect(
      evaluateRewards({}, [], REWARDS, { now: after, seasonProgress: { 'autumn-2-2026': 500 } }),
    ).toEqual([]);
    expect(evaluateRewards({}, [], REWARDS, { now })).toEqual([]);
  });

  it('brings missed items back in the re-release a year later', () => {
    const later = new Date(`${autumn2.rerelease.start}T12:00:00Z`);
    const got = evaluateRewards({}, [], REWARDS, {
      now: later,
      seasonProgress: { 'autumn-2-2026': 25 },
    }).map((r) => r.id);
    expect(got).toContain('autumn-2-2026-1');
  });

  it('never unlocks seasonal items without a date', () => {
    expect(evaluateRewards({}, [], REWARDS, { seasonProgress: { 'autumn-2-2026': 500 } })).toEqual(
      [],
    );
  });
});

describe('rewardProgress', () => {
  it('shows how close a stat target is, capped at the target', () => {
    const streak30 = byId('streak-30');
    expect(rewardProgress(streak30, { bestStreak: 12 })).toEqual({ current: 12, target: 30 });
    expect(rewardProgress(streak30, { bestStreak: 45 })).toEqual({ current: 30, target: 30 });
    expect(rewardProgress(streak30, {})).toEqual({ current: 0, target: 30 });
  });

  it('counts collection members earned and season progress', () => {
    const gig = COLLECTIONS.find((c) => c.id === 'gig-kit')!;
    expect(
      rewardProgress(byId('gig-kit-complete'), {}, { earnedIds: gig.members.slice(0, 2) }),
    ).toEqual({ current: 2, target: gig.members.length });
    expect(rewardProgress(byId('gig-kit-complete'), {})).toEqual({
      current: 0,
      target: gig.members.length,
    });
    expect(
      rewardProgress(byId('autumn-2-2026-3'), {}, { seasonProgress: { 'autumn-2-2026': 70 } }),
    ).toEqual({ current: 70, target: 100 });
    expect(rewardProgress(byId('autumn-2-2026-3'), {})).toEqual({ current: 0, target: 100 });
  });

  it('treats an unknown collection as having no members', () => {
    const odd: Reward = {
      ...byId('gig-kit-complete'),
      target: { kind: 'collection', collectionId: 'x' },
    };
    expect(rewardProgress(odd, {})).toEqual({ current: 0, target: 0 });
  });
});

describe('progressionStats', () => {
  const today = '2026-11-24';
  const day = (d: string, xp: number) => ({ at: new Date(`${d}T12:00:00Z`), xp });

  it('turns reward XP into a level, prestige stars and chapter XP', () => {
    const stats = progressionStats({ xpEvents: [day('2026-10-01', 250)], yearGroup: 10, today });
    expect(stats).toMatchObject({ level: 1, prestigeStars: 0, chapter2Xp: 250, chapter1Xp: 0 });
    expect(
      progressionStats({
        xpEvents: Array.from({ length: 400 }, (_, i) =>
          day(new Date(Date.UTC(2026, 8, 1) + i * 86_400_000).toISOString().slice(0, 10), 300),
        ),
        yearGroup: 13,
        today: '2027-10-05',
      }).level,
    ).toBeGreaterThan(50);
  });

  it('ignores late-night XP and caps each day', () => {
    const stats = progressionStats({
      xpEvents: [
        { at: new Date('2026-10-01T23:30:00Z'), xp: 1000 },
        day('2026-10-02', DAILY_REWARD_XP_CAP + 500),
      ],
      yearGroup: 10,
      today,
    });
    expect(stats.chapter2Xp).toBe(DAILY_REWARD_XP_CAP);
  });

  it('carries GCSE completion over to A-Level students', () => {
    expect(progressionStats({ xpEvents: [], yearGroup: 12, today })).toMatchObject({
      gcseExamsSat: 1,
      gcseFinished: 1,
    });
    expect(progressionStats({ xpEvents: [], yearGroup: 11, today }).gcseFinished).toBeUndefined();
  });

  it('gives prestige stars past level 100 from the XP total it is given', () => {
    const stats = progressionStats({
      xpEvents: [],
      yearGroup: 13,
      today,
      totalRewardXp: xpForLevel(100) + PRESTIGE_XP,
    });
    expect(stats).toMatchObject({ level: 100, prestigeStars: 1 });
  });
});

describe('rewardsOverview', () => {
  it('shows level, the current chapter track, the next milestones, collections and live drops', () => {
    const view = rewardsOverview({
      stats: { level: 4, chapter2Xp: CHAPTER_STEP_XP * 3 + 10, bestStreak: 5, correctAnswers: 80 },
      earnedIds: ['chapter-2-1', 'chapter-2-2', 'chapter-2-3'],
      totalRewardXp: 1050,
      yearGroup: 10,
      now,
      seasonProgress: { 'autumn-2-2026': 30 },
    });
    expect(view.level.level).toBe(4);
    expect(view.chapter).toMatchObject({ number: 2, name: 'Building Up', earned: 3, total: 30 });
    expect(view.chapter!.next).toMatchObject({
      id: 'chapter-2-4',
      current: 10,
      target: CHAPTER_STEP_XP,
    });
    expect(view.nextMilestones.map((m) => m.id)).toEqual([
      'correct-100',
      'streak-7',
      'subject-topics-5',
    ]);
    expect(view.collections.find((c) => c.id === 'gig-kit')).toMatchObject({
      name: 'Gig kit',
      // Chapter 2 step 1 (Practice amp) is in the Gig kit.
      earned: 1,
      complete: false,
    });
    expect(view.seasons.map((s) => s.id)).toEqual(['autumn-2-2026']);
    expect(view.seasons[0]!.items[0]).toMatchObject({
      id: 'autumn-2-2026-1',
      earned: false,
      current: 25,
    });
  });

  it('has no chapter for a year group outside Years 9 to 13', () => {
    const view = rewardsOverview({
      stats: {},
      earnedIds: [],
      totalRewardXp: 0,
      yearGroup: 8,
      now,
    });
    expect(view.chapter).toBeNull();
    expect(view.seasons[0]!.items[0]!.current).toBe(0);
  });

  it('shows a finished chapter with no next step', () => {
    const chapterIds = REWARDS.filter((r) => r.id.startsWith('chapter-1-')).map((r) => r.id);
    const view = rewardsOverview({
      stats: { chapter1Xp: CHAPTER_FULL_XP },
      earnedIds: chapterIds,
      totalRewardXp: 0,
      yearGroup: 9,
      now,
    });
    expect(view.chapter).toMatchObject({ earned: 30, next: null });
  });
});
