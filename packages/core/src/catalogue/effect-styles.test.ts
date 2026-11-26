import { describe, expect, it } from 'vitest';
import { AVATAR_CATALOGUE } from '../avatar';
import { RewardItemSchema } from '../rewards-schemas';
import { COLLECTIONS, REWARDS, SEASONS, validateCatalogue } from './index';
import { effectStylesFor } from './effect-styles';

// J10b: effect styles (how rewards and celebrations look). Sticker Book is the default for
// everyone; Pop Burst and Starlight come with existing learning milestones, never by paying.
const reward = (id: string) => REWARDS.find((r) => r.id === id)!;

describe('effect style rewards', () => {
  it('adds Pop Burst to the level 5 reward and Starlight to the 10 topics mastered reward', () => {
    expect(reward('level-5').target).toEqual({ kind: 'stat', stat: 'level', atLeast: 5 });
    expect(reward('level-5').items).toContainEqual({ kind: 'effectStyle', id: 'pop-burst' });
    expect(reward('topics-mastered-10').target).toEqual({
      kind: 'stat',
      stat: 'topicsMastered',
      atLeast: 10,
    });
    expect(reward('topics-mastered-10').items).toContainEqual({
      kind: 'effectStyle',
      id: 'starlight',
    });
  });

  it('keeps what those rewards already gave', () => {
    expect(reward('level-5').items.filter((i) => i.kind !== 'effectStyle').length).toBeGreaterThan(
      0,
    );
    expect(
      reward('topics-mastered-10').items.filter((i) => i.kind !== 'effectStyle').length,
    ).toBeGreaterThan(0);
  });

  it('never offers Sticker Book as a reward, and the catalogue stays valid', () => {
    const styles = REWARDS.flatMap((r) => r.items).filter((i) => i.kind === 'effectStyle');
    expect(styles.map((i) => i.id).sort()).toEqual(['pop-burst', 'starlight']);
    expect(
      validateCatalogue(REWARDS, {
        collections: COLLECTIONS,
        seasons: SEASONS,
        avatar: AVATAR_CATALOGUE,
      }),
    ).toEqual([]);
  });

  it('lists the styles a child has unlocked from their earned rewards', () => {
    expect(effectStylesFor([])).toEqual([]);
    expect(effectStylesFor(['level-2', 'level-5'])).toEqual(['pop-burst']);
    expect(effectStylesFor(['topics-mastered-10', 'level-5', 'nope'])).toEqual([
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
