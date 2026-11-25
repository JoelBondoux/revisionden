import {
  APPEARANCE_KEY,
  DEFAULT_APPEARANCE,
  applyAppearance,
  loadAppearance,
  resolveTheme,
  saveAppearance,
} from './settings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe('appearance settings', () => {
  it('defaults to the system theme, standard colours and the background pattern on', () => {
    expect(DEFAULT_APPEARANCE).toEqual({ theme: 'system', palette: 'standard', pattern: 'on' });
    expect(loadAppearance(memoryStorage())).toEqual(DEFAULT_APPEARANCE);
  });

  it('saves and loads per device', () => {
    const storage = memoryStorage();
    saveAppearance(storage, { theme: 'dark', palette: 'colourblind', pattern: 'off' });
    expect(JSON.parse(storage.data.get(APPEARANCE_KEY)!)).toEqual({
      theme: 'dark',
      palette: 'colourblind',
      pattern: 'off',
    });
    expect(loadAppearance(storage)).toEqual({
      theme: 'dark',
      palette: 'colourblind',
      pattern: 'off',
    });
  });

  it('ignores anything invalid or unreadable', () => {
    expect(
      loadAppearance(memoryStorage({ [APPEARANCE_KEY]: '{"theme":"neon","pattern":"off"}' })),
    ).toEqual({ theme: 'system', palette: 'standard', pattern: 'off' });
    expect(loadAppearance(memoryStorage({ [APPEARANCE_KEY]: 'not json' }))).toEqual(
      DEFAULT_APPEARANCE,
    );
    expect(loadAppearance(null)).toEqual(DEFAULT_APPEARANCE);
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadAppearance(throwing)).toEqual(DEFAULT_APPEARANCE);
    expect(() => saveAppearance(throwing, DEFAULT_APPEARANCE)).not.toThrow();
  });

  it('follows the device for System, and a choice otherwise', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('applies the choices as data attributes on the page', () => {
    const root = document.createElement('html');
    applyAppearance(root, { theme: 'system', palette: 'colourblind', pattern: 'off' }, true);
    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.palette).toBe('colourblind');
    expect(root.dataset.pattern).toBe('off');
    expect(root.style.colorScheme).toBe('dark');
    applyAppearance(root, DEFAULT_APPEARANCE, false);
    expect(root.dataset.theme).toBe('light');
    expect(root.dataset.palette).toBe('standard');
    expect(root.dataset.pattern).toBe('on');
    expect(root.style.colorScheme).toBe('light');
  });
});
