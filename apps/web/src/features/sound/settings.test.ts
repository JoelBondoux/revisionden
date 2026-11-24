import {
  DEFAULT_SOUND_SETTINGS,
  loadSoundSettings,
  saveSoundSettings,
  SOUND_KEY,
} from './settings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

describe('sound settings', () => {
  it('default to sound on, medium volume and tap sounds off', () => {
    expect(DEFAULT_SOUND_SETTINGS).toEqual({ enabled: true, volume: 'medium', taps: false });
    expect(loadSoundSettings(memoryStorage())).toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('are saved on this device and read back', () => {
    const storage = memoryStorage();
    saveSoundSettings(storage, { enabled: false, volume: 'high', taps: true });
    expect(loadSoundSettings(storage)).toEqual({ enabled: false, volume: 'high', taps: true });
    expect(storage.data.has(SOUND_KEY)).toBe(true);
  });

  it('fall back to the defaults for anything saved that is not valid', () => {
    const storage = memoryStorage({ [SOUND_KEY]: '{"enabled":"yes","volume":"loud","taps":true}' });
    expect(loadSoundSettings(storage)).toEqual({ ...DEFAULT_SOUND_SETTINGS, taps: true });
    expect(loadSoundSettings(memoryStorage({ [SOUND_KEY]: 'not json' }))).toEqual(
      DEFAULT_SOUND_SETTINGS,
    );
    expect(loadSoundSettings(memoryStorage({ [SOUND_KEY]: 'null' }))).toEqual(
      DEFAULT_SOUND_SETTINGS,
    );
  });

  it('survive storage that throws (private browsing, blocked site data)', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSoundSettings(broken)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(() => saveSoundSettings(broken, DEFAULT_SOUND_SETTINGS)).not.toThrow();
    expect(loadSoundSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(() => saveSoundSettings(null, DEFAULT_SOUND_SETTINGS)).not.toThrow();
  });
});
