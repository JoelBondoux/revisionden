import {
  applyReadingSettings,
  DEFAULT_READING_SETTINGS,
  loadReadingSettings,
  READING_KEY,
  saveReadingSettings,
} from './settings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe('reading comfort settings', () => {
  it('default to the standard font, normal text, normal spacing and no tint', () => {
    expect(DEFAULT_READING_SETTINGS).toEqual({
      font: 'standard',
      textSize: 'normal',
      spacing: 'normal',
      tint: 'none',
    });
    expect(loadReadingSettings(memoryStorage())).toEqual(DEFAULT_READING_SETTINGS);
  });

  it('are saved on this device and read back', () => {
    const storage = memoryStorage();
    const chosen = {
      font: 'dyslexic',
      textSize: 'larger',
      spacing: 'wide',
      tint: 'cream',
    } as const;
    saveReadingSettings(storage, chosen);
    expect(storage.data.has(READING_KEY)).toBe(true);
    expect(loadReadingSettings(storage)).toEqual(chosen);
  });

  it('fall back to the defaults for anything saved that is not valid', () => {
    const storage = memoryStorage({
      [READING_KEY]: '{"font":"comic","textSize":"large","spacing":7,"tint":"blue"}',
    });
    expect(loadReadingSettings(storage)).toEqual({
      ...DEFAULT_READING_SETTINGS,
      textSize: 'large',
      tint: 'blue',
    });
    expect(loadReadingSettings(memoryStorage({ [READING_KEY]: 'not json' }))).toEqual(
      DEFAULT_READING_SETTINGS,
    );
    expect(loadReadingSettings(null)).toEqual(DEFAULT_READING_SETTINGS);
  });

  it('keep going when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadReadingSettings(broken)).toEqual(DEFAULT_READING_SETTINGS);
    expect(() => saveReadingSettings(broken, DEFAULT_READING_SETTINGS)).not.toThrow();
  });

  it('are applied to the whole page as data attributes on the root element', () => {
    const root = document.createElement('html');
    applyReadingSettings(root, {
      font: 'dyslexic',
      textSize: 'large',
      spacing: 'wide',
      tint: 'blue',
    });
    expect(root.dataset.readingFont).toBe('dyslexic');
    expect(root.dataset.readingSize).toBe('large');
    expect(root.dataset.readingSpacing).toBe('wide');
    expect(root.dataset.readingTint).toBe('blue');
  });

  it('leave no attributes behind for the defaults, so the normal design shows', () => {
    const root = document.createElement('html');
    applyReadingSettings(root, {
      font: 'dyslexic',
      textSize: 'large',
      spacing: 'wide',
      tint: 'blue',
    });
    applyReadingSettings(root, DEFAULT_READING_SETTINGS);
    expect(root.getAttributeNames()).toEqual([]);
  });
});
