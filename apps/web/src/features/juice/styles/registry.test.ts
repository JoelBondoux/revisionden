import {
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
// Rewards. Sticker Book is the default and is always available.
describe('effect style registry', () => {
  it('has Sticker Book as the default, with a name and a plain description', () => {
    expect(DEFAULT_EFFECT_STYLE).toBe('sticker-book');
    expect(EFFECT_STYLE_IDS).toContain('sticker-book');
    const style = EFFECT_STYLES['sticker-book'];
    expect(style.name).toBe('Sticker Book');
    expect(style.description.length).toBeGreaterThan(20);
  });

  it('describes every style by its own id', () => {
    for (const id of EFFECT_STYLE_IDS) expect(EFFECT_STYLES[id].id).toBe(id);
  });
});

describe('choosing a style', () => {
  it('uses the saved style when it is available, and Sticker Book otherwise', () => {
    expect(chooseEffectStyle('sticker-book', [])).toBe('sticker-book');
    expect(chooseEffectStyle('neon-disco', ['sticker-book'])).toBe('sticker-book');
    expect(chooseEffectStyle(undefined, [])).toBe('sticker-book');
    expect(chooseEffectStyle(42, [])).toBe('sticker-book');
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
      'sticker-book',
    );
    expect(loadEffectStyle(null)).toBe('sticker-book');
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadEffectStyle(blocked)).toBe('sticker-book');
    expect(() => saveEffectStyle(blocked, 'sticker-book')).not.toThrow();
  });

  it('applies the style to the page as a data attribute', () => {
    const root = document.createElement('html');
    applyEffectStyle(root, 'sticker-book');
    expect(root.dataset.effectStyle).toBe('sticker-book');
  });
});
