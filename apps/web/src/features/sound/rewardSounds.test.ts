import { biggestReward, pickVariation, rewardSoundSpec, VARIATIONS_PER_TIER } from './rewardSounds';

describe('reward sound choice', () => {
  it('follows the reward rarity for the tier', () => {
    expect(rewardSoundSpec({ id: 'streak-7', rarity: 'common' }).tier).toBe('common');
    expect(rewardSoundSpec({ id: 'streak-60', rarity: 'rare' }).tier).toBe('rare');
    expect(rewardSoundSpec({ id: 'streak-500', rarity: 'epic' }).tier).toBe('epic');
    expect(rewardSoundSpec({ id: 'streak-1000', rarity: 'legendary' }).tier).toBe('legendary');
  });

  it('climbs each milestone ladder one step at a time', () => {
    const steps = ['streak-7', 'streak-30', 'streak-60', 'streak-100'].map(
      (id) => rewardSoundSpec({ id, rarity: 'common' }).step,
    );
    expect(steps).toEqual([0, 1, 2, 3]);
    expect(rewardSoundSpec({ id: 'correct-100', rarity: 'common' }).step).toBe(0);
    expect(rewardSoundSpec({ id: 'correct-500', rarity: 'common' }).step).toBe(1);
  });

  it('rises every 10 levels; every 10th level is rare; prestige is legendary', () => {
    expect(rewardSoundSpec({ id: 'level-9', rarity: 'common' })).toMatchObject({ step: 0 });
    expect(rewardSoundSpec({ id: 'level-10', rarity: 'rare' })).toMatchObject({
      tier: 'rare',
      step: 1,
    });
    expect(rewardSoundSpec({ id: 'level-57', rarity: 'common' }).step).toBe(5);
    expect(rewardSoundSpec({ id: 'prestige-1', rarity: 'epic' }).tier).toBe('legendary');
  });

  it('gives each year chapter its own voice and the finisher sets their own fanfare', () => {
    expect(rewardSoundSpec({ id: 'chapter-1-3', rarity: 'common' }).voice).toBe('chapter1');
    expect(rewardSoundSpec({ id: 'chapter-4-finale', rarity: 'epic' }).voice).toBe('chapter4');
    expect(rewardSoundSpec({ id: 'chapter-3-finale', rarity: 'legendary' }).fanfare).toBe('gcse');
    expect(rewardSoundSpec({ id: 'chapter-5-finale', rarity: 'legendary' }).fanfare).toBe('aLevel');
    expect(rewardSoundSpec({ id: 'streak-7', rarity: 'common' })).toMatchObject({
      voice: 'standard',
      fanfare: null,
    });
  });

  it('copes with rewards it does not know (for example parent-set ones)', () => {
    expect(rewardSoundSpec({ id: 'something-new', rarity: 'rare' })).toEqual({
      tier: 'rare',
      step: 0,
      voice: 'standard',
      fanfare: null,
    });
  });

  it('picks only the biggest of several rewards', () => {
    const big = biggestReward([
      { id: 'level-9', rarity: 'common' },
      { id: 'streak-100', rarity: 'epic' },
      { id: 'streak-30', rarity: 'epic' },
      { id: 'chapter-2-4', rarity: 'rare' },
    ]);
    expect(big?.id).toBe('streak-100');
    expect(biggestReward([])).toBeNull();
    expect(
      biggestReward([
        { id: 'streak-1000', rarity: 'legendary' },
        { id: 'chapter-3-finale', rarity: 'legendary' },
      ])?.id,
    ).toBe('chapter-3-finale');
  });

  it('never picks the same variation twice in a row', () => {
    expect(VARIATIONS_PER_TIER).toBeGreaterThanOrEqual(4);
    let last: number | null = null;
    const seen = new Set<number>();
    const values = [0, 0.99, 0.5, 0.2, 0.7, 0, 0, 0.3];
    for (const r of values) {
      const next = pickVariation(VARIATIONS_PER_TIER, last, () => r);
      expect(next).not.toBe(last);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(VARIATIONS_PER_TIER);
      seen.add(next);
      last = next;
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});
