import {
  DEFAULT_READ_ALOUD_SETTINGS,
  isReadAloudOn,
  loadReadAloudSettings,
  READ_ALOUD_KEY,
  saveReadAloudSettings,
} from './settings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe('read aloud settings', () => {
  it('default to no choice yet and normal speed', () => {
    expect(DEFAULT_READ_ALOUD_SETTINGS).toEqual({ enabled: null, rate: 1 });
    expect(loadReadAloudSettings(memoryStorage())).toEqual(DEFAULT_READ_ALOUD_SETTINGS);
  });

  it('are on by default only when the device has its own voice', () => {
    expect(isReadAloudOn(DEFAULT_READ_ALOUD_SETTINGS, { onDevice: true })).toBe(true);
    expect(isReadAloudOn(DEFAULT_READ_ALOUD_SETTINGS, { onDevice: false })).toBe(false);
    expect(isReadAloudOn(DEFAULT_READ_ALOUD_SETTINGS, null)).toBe(false);
  });

  it('follow the student once they choose, but never without a voice', () => {
    expect(isReadAloudOn({ enabled: true, rate: 1 }, { onDevice: false })).toBe(true);
    expect(isReadAloudOn({ enabled: false, rate: 1 }, { onDevice: true })).toBe(false);
    expect(isReadAloudOn({ enabled: true, rate: 1 }, null)).toBe(false);
  });

  it('are saved on this device, and anything invalid uses the default', () => {
    const storage = memoryStorage();
    saveReadAloudSettings(storage, { enabled: true, rate: 0.75 });
    expect(loadReadAloudSettings(storage)).toEqual({ enabled: true, rate: 0.75 });
    expect(
      loadReadAloudSettings(memoryStorage({ [READ_ALOUD_KEY]: '{"enabled":"yes","rate":3}' })),
    ).toEqual(DEFAULT_READ_ALOUD_SETTINGS);
    expect(loadReadAloudSettings(memoryStorage({ [READ_ALOUD_KEY]: '{' }))).toEqual(
      DEFAULT_READ_ALOUD_SETTINGS,
    );
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadReadAloudSettings(broken)).toEqual(DEFAULT_READ_ALOUD_SETTINGS);
    expect(() => saveReadAloudSettings(broken, DEFAULT_READ_ALOUD_SETTINGS)).not.toThrow();
  });
});
