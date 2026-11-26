import { EFFECT_STYLE_UNLOCKS } from '@revisionden/core';
import {
  COMING_SOON_STYLES,
  DEFAULT_EFFECT_STYLE,
  EFFECT_STYLES,
  EFFECT_STYLE_IDS,
  EFFECT_STYLE_KEY,
  applyEffectStyle,
  chooseEffectStyle,
  loadEffectStyle,
  saveEffectStyle,
} from './registry';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

// J10: effect styles. One style is active at a time; it restyles the game-feel moments, Home and
// Rewards. Doodle Diary is the default and is always available.
describe('effect style registry', () => {
  it('has Doodle Diary as the free default, with a name and a plain description', () => {
    expect(DEFAULT_EFFECT_STYLE).toBe('doodle-diary');
    expect(EFFECT_STYLE_IDS[0]).toBe('doodle-diary');
    const style = EFFECT_STYLES['doodle-diary'];
    expect(style.name).toBe('Doodle Diary');
    expect(style.unlock).toBeUndefined();
    expect(style.description.length).toBeGreaterThan(20);
  });

  it('describes every style by its own id, with a three-colour preview', () => {
    for (const id of EFFECT_STYLE_IDS) {
      expect(EFFECT_STYLES[id].id).toBe(id);
      expect(EFFECT_STYLES[id].swatch).toHaveLength(3);
    }
  });

  it('has Pop Burst and Starlight to unlock, each saying how', () => {
    expect(EFFECT_STYLES['pop-burst']).toMatchObject({
      name: 'Pop Burst',
      unlock: 'Reach level 5',
    });
    expect(EFFECT_STYLES.starlight).toMatchObject({
      name: 'Starlight',
      unlock: 'Master 10 topics',
    });
    expect(EFFECT_STYLES['sticker-book'].unlock).toBe('Reach level 3');
  });

  it('lists every style the rewards catalogue unlocks: built ones, then the ones coming soon', () => {
    const fromCatalogue = EFFECT_STYLE_UNLOCKS.map((u) => u.style).filter(
      (id) => id !== DEFAULT_EFFECT_STYLE,
    );
    const built = EFFECT_STYLE_IDS.filter((id) => EFFECT_STYLES[id].unlock);
    const soon = COMING_SOON_STYLES.map((s) => s.id);
    expect([...built, ...soon].sort()).toEqual([...fromCatalogue].sort());
    for (const id of soon) expect(EFFECT_STYLE_IDS as readonly string[]).not.toContain(id);
  });

  it("builds every style on the owner's ladder, each saying how to unlock it", () => {
    expect(COMING_SOON_STYLES).toEqual([]);
    expect(
      EFFECT_STYLE_IDS.filter((id) => id !== DEFAULT_EFFECT_STYLE).map((id) => [
        EFFECT_STYLES[id].name,
        EFFECT_STYLES[id].unlock,
      ]),
    ).toEqual([
      ['Sticker Book', 'Reach level 3'],
      ['Pop Burst', 'Reach level 5'],
      ['Garden Grow', 'Master 5 topics in a subject'],
      ['Starlight', 'Master 10 topics'],
      ['Comic Pop', 'Reach level 20'],
      ['Pixel Arcade', 'Reach level 40'],
    ]);
  });
});

describe('choosing a style', () => {
  it('uses an unlocked style the child picked', () => {
    expect(chooseEffectStyle('pop-burst', ['pop-burst'])).toBe('pop-burst');
    expect(chooseEffectStyle('starlight', ['pop-burst'])).toBe('doodle-diary');
  });

  it('uses the saved style when it is available, and Doodle Diary otherwise', () => {
    expect(chooseEffectStyle('doodle-diary', [])).toBe('doodle-diary');
    expect(chooseEffectStyle('neon-disco', ['sticker-book'])).toBe('doodle-diary');
    expect(chooseEffectStyle(undefined, [])).toBe('doodle-diary');
    expect(chooseEffectStyle(42, [])).toBe('doodle-diary');
  });
});

describe('saving the choice on this device', () => {
  it('saves and loads it, ignoring anything invalid or blocked', () => {
    const storage = memoryStorage();
    expect(loadEffectStyle(storage)).toBe(DEFAULT_EFFECT_STYLE);
    saveEffectStyle(storage, 'sticker-book');
    expect(storage.data.get(EFFECT_STYLE_KEY)).toBe('sticker-book');
    expect(loadEffectStyle(storage)).toBe('sticker-book');
    expect(loadEffectStyle(memoryStorage({ [EFFECT_STYLE_KEY]: 'neon-disco' }))).toBe(
      'doodle-diary',
    );
    expect(loadEffectStyle(null)).toBe('doodle-diary');
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadEffectStyle(blocked)).toBe('doodle-diary');
    expect(() => saveEffectStyle(blocked, 'sticker-book')).not.toThrow();
  });

  it('applies the style to the page as a data attribute', () => {
    const root = document.createElement('html');
    applyEffectStyle(root, 'sticker-book');
    expect(root.dataset.effectStyle).toBe('sticker-book');
  });
});
