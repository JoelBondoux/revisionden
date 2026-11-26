import { describe, expect, it } from 'vitest';
import { REWARDS, validateCatalogue, evaluateRewards, rewardsOverview } from './rewards';
import { COLLECTIONS, SEASONS } from './catalogue';
import { AVATAR_CATALOGUE } from './avatar';
import { FOUNDING_TESTER_ID, foundingTesterStat } from './founding-tester';
import { titleWordsFor } from './titles';

const cutOff = new Date('2027-09-01T00:00:00Z');
const before = new Date('2027-08-31T18:00:00Z');
const after = new Date('2027-09-02T10:00:00Z');

describe('Founding Tester (R5)', () => {
  it('goes to nobody while the 1.0 cut-off is unset', () => {
    expect(foundingTesterStat({ betaEndsAt: undefined, now: after, activityAt: [before] })).toBe(0);
  });

  it('goes to nobody before the cut-off has passed, even with activity', () => {
    expect(foundingTesterStat({ betaEndsAt: cutOff, now: before, activityAt: [before] })).toBe(0);
  });

  it('goes to a student with activity before the cut-off, once it has passed', () => {
    expect(foundingTesterStat({ betaEndsAt: cutOff, now: after, activityAt: [before] })).toBe(1);
  });

  it('does not go to an account that was never used', () => {
    expect(foundingTesterStat({ betaEndsAt: cutOff, now: after, activityAt: [] })).toBe(0);
  });

  it('does not count activity after the cut-off, or exactly at it (1.0 has started by then)', () => {
    expect(foundingTesterStat({ betaEndsAt: cutOff, now: after, activityAt: [after] })).toBe(0);
    expect(foundingTesterStat({ betaEndsAt: cutOff, now: after, activityAt: [cutOff] })).toBe(0);
  });

  it('is a one-off catalogue reward with a badge and the "Founding Tester" title words', () => {
    const reward = REWARDS.find((r) => r.id === FOUNDING_TESTER_ID)!;
    expect(reward).toMatchObject({
      source: 'special',
      name: 'Founding Tester',
      target: { kind: 'stat', stat: 'foundingTester', atLeast: 1 },
    });
    expect(reward.items).toEqual([
      { kind: 'badge', id: 'founding-tester' },
      { kind: 'titleWord', part: 'first', text: 'Founding' },
      { kind: 'titleWord', part: 'last', text: 'Tester' },
    ]);
    const words = titleWordsFor([FOUNDING_TESTER_ID]);
    expect(words.first.map((w) => w.text)).toEqual(['Founding']);
    expect(words.last.map((w) => w.text)).toEqual(['Tester']);
    const parts = { collections: COLLECTIONS, seasons: SEASONS, avatar: AVATAR_CATALOGUE };
    expect(validateCatalogue(REWARDS, parts)).toEqual([]);
  });

  it('is awarded once by the normal evaluator, and never again', () => {
    const first = evaluateRewards({ foundingTester: 1 }, []);
    expect(first.map((r) => r.id)).toContain(FOUNDING_TESTER_ID);
    const again = evaluateRewards({ foundingTester: 1 }, [FOUNDING_TESTER_ID]);
    expect(again.map((r) => r.id)).not.toContain(FOUNDING_TESTER_ID);
  });

  it('stays out of the rewards overview until earned (no teaser before 1.0)', () => {
    const base = { stats: {}, totalRewardXp: 0, yearGroup: 10, now: before };
    const unearned = rewardsOverview({ ...base, earnedIds: [] });
    expect(JSON.stringify(unearned)).not.toContain('Founding');
    const earned = rewardsOverview({ ...base, earnedIds: [FOUNDING_TESTER_ID] });
    expect(earned.special.map((c) => c.id)).toEqual([FOUNDING_TESTER_ID]);
  });
});
