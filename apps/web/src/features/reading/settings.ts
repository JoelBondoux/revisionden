/** Reading comfort settings, saved per device (docs/PRODUCT_RULES.md, Quick wins). */
export type ReadingFont = 'standard' | 'dyslexic';
export type ReadingTextSize = 'normal' | 'large' | 'larger';
export type ReadingSpacing = 'normal' | 'wide';
export type ReadingTint = 'none' | 'cream' | 'blue';

export interface ReadingSettings {
  /** 'dyslexic' swaps the app font for the self-hosted OpenDyslexic font. */
  font: ReadingFont;
  textSize: ReadingTextSize;
  /** 'wide' adds line, letter and word spacing. */
  spacing: ReadingSpacing;
  /** A soft tinted background behind the text. */
  tint: ReadingTint;
}

export const DEFAULT_READING_SETTINGS: ReadingSettings = Object.freeze({
  font: 'standard',
  textSize: 'normal',
  spacing: 'normal',
  tint: 'none',
});

export const READING_KEY = 'revisionden.reading';

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const CHOICES: { [K in keyof ReadingSettings]: readonly ReadingSettings[K][] } = {
  font: ['standard', 'dyslexic'],
  textSize: ['normal', 'large', 'larger'],
  spacing: ['normal', 'wide'],
  tint: ['none', 'cream', 'blue'],
};

function pick<K extends keyof ReadingSettings>(
  saved: Record<string, unknown>,
  key: K,
): ReadingSettings[K] {
  const value = saved[key] as ReadingSettings[K];
  return CHOICES[key].includes(value) ? value : DEFAULT_READING_SETTINGS[key];
}

/** Reads this device's reading settings; anything missing, invalid or unreadable uses the default. */
export function loadReadingSettings(storage: SettingsStorage | null): ReadingSettings {
  let saved: unknown = null;
  try {
    saved = JSON.parse(storage?.getItem(READING_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  if (typeof saved !== 'object' || saved === null) return { ...DEFAULT_READING_SETTINGS };
  const s = saved as Record<string, unknown>;
  return {
    font: pick(s, 'font'),
    textSize: pick(s, 'textSize'),
    spacing: pick(s, 'spacing'),
    tint: pick(s, 'tint'),
  };
}

/** Saves this device's reading settings. Storage errors are ignored: the setting still applies now. */
export function saveReadingSettings(
  storage: SettingsStorage | null,
  settings: ReadingSettings,
): void {
  try {
    storage?.setItem(READING_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or blocked site data: keep going without saving.
  }
}

const ATTRIBUTES: { [K in keyof ReadingSettings]: string } = {
  font: 'readingFont',
  textSize: 'readingSize',
  spacing: 'readingSpacing',
  tint: 'readingTint',
};

/**
 * Applies the settings app-wide as data attributes on the root element (reading.css reads them).
 * A default value removes its attribute, so the normal design shows unchanged.
 */
export function applyReadingSettings(root: HTMLElement, settings: ReadingSettings): void {
  for (const key of Object.keys(ATTRIBUTES) as (keyof ReadingSettings)[]) {
    const attribute = ATTRIBUTES[key];
    if (settings[key] === DEFAULT_READING_SETTINGS[key]) delete root.dataset[attribute];
    else root.dataset[attribute] = settings[key];
  }
}
