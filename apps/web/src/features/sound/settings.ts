/** Sound settings, saved per device. */
export type SoundVolume = 'low' | 'medium' | 'high';

export interface SoundSettings {
  /** Sound effects on or off (the quick mute). */
  enabled: boolean;
  volume: SoundVolume;
  /** Subtle sounds on every button tap; off by default. */
  taps: boolean;
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = Object.freeze({
  enabled: true,
  volume: 'medium',
  taps: false,
});

export const SOUND_KEY = 'revisionden.sound';

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const VOLUMES: readonly SoundVolume[] = ['low', 'medium', 'high'];

/** Reads this device's sound settings; anything missing, invalid or unreadable uses the default. */
export function loadSoundSettings(storage: SettingsStorage | null): SoundSettings {
  let saved: unknown = null;
  try {
    saved = JSON.parse(storage?.getItem(SOUND_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  if (typeof saved !== 'object' || saved === null) return { ...DEFAULT_SOUND_SETTINGS };
  const s = saved as Record<string, unknown>;
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULT_SOUND_SETTINGS.enabled,
    volume: VOLUMES.includes(s.volume as SoundVolume)
      ? (s.volume as SoundVolume)
      : DEFAULT_SOUND_SETTINGS.volume,
    taps: typeof s.taps === 'boolean' ? s.taps : DEFAULT_SOUND_SETTINGS.taps,
  };
}

/** Saves this device's sound settings. Storage errors are ignored: the setting still applies now. */
export function saveSoundSettings(storage: SettingsStorage | null, settings: SoundSettings): void {
  try {
    storage?.setItem(SOUND_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or blocked site data: keep going without saving.
  }
}
