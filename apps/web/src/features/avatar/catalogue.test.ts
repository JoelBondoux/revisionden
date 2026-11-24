import { AVATAR_CATALOGUE, AVATAR_LAYERS, createRng, type AvatarLayer } from '@revisionden/core';
import { AVATAR_TABS, itemLabel, lockLabel, shuffleAvatar } from './catalogue';

describe('avatar tabs', () => {
  it('has the seven approved tabs covering every layer once', () => {
    expect(AVATAR_TABS.map((t) => t.label)).toEqual([
      'Face',
      'Hair',
      'Top',
      'Eyewear',
      'Headwear',
      'Holding',
      'Background',
    ]);
    const layers = AVATAR_TABS.flatMap((t) => t.sections.map((s) => s.layer));
    expect([...layers].sort()).toEqual([...AVATAR_LAYERS].sort());
  });
});

describe('itemLabel', () => {
  it('turns item ids into plain words', () => {
    expect(itemLabel('skate-park')).toBe('Skate park');
    expect(itemLabel('t-shirt')).toBe('T-shirt');
    expect(itemLabel('none')).toBe('None');
    expect(itemLabel('skin-3')).toBe('Skin 3');
    expect(itemLabel('eyes-wink')).toBe('Wink');
    expect(itemLabel('mouth-grin')).toBe('Grin');
  });
});

describe('lockLabel', () => {
  it('names the reward that unlocks a locked item', () => {
    expect(lockLabel({ id: 'crown', unlockedBy: 'streak-100' })).toBe('Unlock: 100-day streak');
    expect(lockLabel({ id: 'trophy', unlockedBy: 'league-top' })).toBe(
      'Unlock: Top of the friends league',
    );
  });

  it('has no label for a free item', () => {
    expect(lockLabel({ id: 'cap' })).toBeUndefined();
  });
});

describe('shuffleAvatar', () => {
  const isLocked = (layer: AvatarLayer, index: number) =>
    Boolean(AVATAR_CATALOGUE[layer][index]?.unlockedBy);

  it('only picks unlocked items', () => {
    const rng = createRng(1);
    for (let i = 0; i < 200; i += 1) {
      const choices = shuffleAvatar(rng);
      for (const layer of AVATAR_LAYERS) expect(isLocked(layer, choices[layer])).toBe(false);
    }
  });

  it('can pick earned items', () => {
    const rng = createRng(2);
    const seen = new Set<number>();
    for (let i = 0; i < 300; i += 1) seen.add(shuffleAvatar(rng, ['streak-100']).skin);
    const alien = AVATAR_CATALOGUE.skin.findIndex((item) => item.id === 'alien');
    expect(seen.has(alien)).toBe(true);
  });

  it('is repeatable with the same seed', () => {
    expect(shuffleAvatar(createRng(7))).toEqual(shuffleAvatar(createRng(7)));
  });
});
