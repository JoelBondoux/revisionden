/** Read aloud settings, saved per device (docs/PRODUCT_RULES.md, Quick wins). */
export type ReadAloudRate = 0.75 | 1 | 1.25;

export interface ReadAloudSettings {
  /** null until the student chooses: then it is on only when the device has its own voice. */
  enabled: boolean | null;
  rate: ReadAloudRate;
}

export const DEFAULT_READ_ALOUD_SETTINGS: ReadAloudSettings = Object.freeze({
  enabled: null,
  rate: 1,
});

export const READ_ALOUD_KEY = 'revisionden.readAloud';

export const RATES: readonly ReadAloudRate[] = [0.75, 1, 1.25];

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Whether read aloud buttons show: never without a voice; by default only with an on-device one. */
export function isReadAloudOn(
  settings: ReadAloudSettings,
  voice: { onDevice: boolean } | null,
): boolean {
  if (!voice) return false;
  return settings.enabled ?? voice.onDevice;
}

export function loadReadAloudSettings(storage: SettingsStorage | null): ReadAloudSettings {
  let saved: unknown = null;
  try {
    saved = JSON.parse(storage?.getItem(READ_ALOUD_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  if (typeof saved !== 'object' || saved === null) return { ...DEFAULT_READ_ALOUD_SETTINGS };
  const s = saved as Record<string, unknown>;
  return {
    enabled: typeof s.enabled === 'boolean' ? s.enabled : DEFAULT_READ_ALOUD_SETTINGS.enabled,
    rate: RATES.includes(s.rate as ReadAloudRate)
      ? (s.rate as ReadAloudRate)
      : DEFAULT_READ_ALOUD_SETTINGS.rate,
  };
}

/** Saves this device's read aloud settings. Storage errors are ignored. */
export function saveReadAloudSettings(
  storage: SettingsStorage | null,
  settings: ReadAloudSettings,
): void {
  try {
    storage?.setItem(READ_ALOUD_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or blocked site data: keep going without saving.
  }
}
