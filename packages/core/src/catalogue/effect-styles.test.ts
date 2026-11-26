import { describe, expect, it } from 'vitest';
import { AVATAR_CATALOGUE } from '../avatar';
import { RewardItemSchema } from '../rewards-schemas';
import { COLLECTIONS, REWARDS, SEASONS, validateCatalogue } from './index';
import { effectStylesFor } from './effect-styles';

// J10b: effect styles (how rewards and celebrations look). Sticker Book is the default for
// everyone; Pop Burst and Starlight come with existing learning milestones, never by paying.
const reward = (id: string) => REWARDS.find((r) => r.id === id)!;

describe('effect style rewards', () => {
  it("follows the owner's ladder, spread across the years, each on a reward that already exists", () => {
    const ladder: [string, string, unknown][] = [
      ['sticker-book', 'level-3', { kind: 'stat', stat: 'level', atLeast: 3 }],
      ['pop-burst', 'level-5', { kind: 'stat', stat: 'level', atLeast: 5 }],
      [
        'garden-grow',
        'subject-topics-5',
        { kind: 'stat', stat: 'bestSubjectTopicsMastered', atLeast: 5 },
      ],
      ['starlight', 'topics-mastered-10', { kind: 'stat', stat: 'topicsMastered', atLeast: 10 }],
      ['comic-pop', 'level-20', { kind: 'stat', stat: 'level', atLeast: 20 }],
      ['pixel-arcade', 'level-40', { kind: 'stat', stat: 'level', atLeast: 40 }],
      // J16 (U7, owner-approved 2026-11-26): three styles unlocked together by the starting test.
      ['petal-glow', 'starting-test', { kind: 'stat', stat: 'startingTestsCompleted', atLeast: 1 }],
      [
        'turbo-drive',
        'starting-test',
        { kind: 'stat', stat: 'startingTestsCompleted', atLeast: 1 },
      ],
      [
        'rainbow-parade',
        'starting-test',
        { kind: 'stat', stat: 'startingTestsCompleted', atLeast: 1 },
      ],
    ];
    for (const [style, rewardId, target] of ladder) {
      expect(reward(rewardId).target, rewardId).toEqual(target);
      expect(reward(rewardId).items).toContainEqual({ kind: 'effectStyle', id: style });
      expect(reward(rewardId).items.filter((i) => i.kind !== 'effectStyle').length).toBeGreaterThan(
        0,
      );
    }
    const styles = REWARDS.flatMap((r) => r.items).filter((i) => i.kind === 'effectStyle');
    expect(styles).toHaveLength(ladder.length);
  });

  it('keeps the catalogue valid', () => {
    expect(
      validateCatalogue(REWARDS, {
        collections: COLLECTIONS,
        seasons: SEASONS,
        avatar: AVATAR_CATALOGUE,
      }),
    ).toEqual([]);
  });

  it('lists the styles a child has unlocked from their earned rewards, in ladder order', () => {
    expect(effectStylesFor([])).toEqual([]);
    expect(effectStylesFor(['level-2', 'level-5'])).toEqual(['pop-burst']);
    expect(effectStylesFor(['starting-test'])).toEqual([
      'petal-glow',
      'turbo-drive',
      'rainbow-parade',
    ]);
    expect(effectStylesFor(['topics-mastered-10', 'level-5', 'level-3', 'nope'])).toEqual([
      'sticker-book',
      'pop-burst',
      'starlight',
    ]);
  });

  it('is a reward item the API accepts', () => {
    expect(RewardItemSchema.parse({ kind: 'effectStyle', id: 'pop-burst' })).toEqual({
      kind: 'effectStyle',
      id: 'pop-burst',
    });
  });
});
