/**
 * Appearance settings (workstream J8), saved per device like the reading settings:
 * theme (System, Light, Dark), colours (Standard, Colour-blind friendly) and the doodle
 * background (On, Off). public/appearance-boot.js applies the same choices before the first
 * paint; keep the two in step (boot.test.ts checks them).
 */
export type ThemeChoice = 'system' | 'light' | 'dark';
export type Palette = 'standard' | 'colourblind';
export type PatternChoice = 'on' | 'off';

export interface AppearanceSettings {
  theme: ThemeChoice;
  palette: Palette;
  pattern: PatternChoice;
}

export const DEFAULT_APPEARANCE: AppearanceSettings = Object.freeze({
  theme: 'system',
  palette: 'standard',
  pattern: 'on',
});

export const APPEARANCE_KEY = 'revisionden.appearance';

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const CHOICES: { [K in keyof AppearanceSettings]: readonly AppearanceSettings[K][] } = {
  theme: ['system', 'light', 'dark'],
  palette: ['standard', 'colourblind'],
  pattern: ['on', 'off'],
};

function pick<K extends keyof AppearanceSettings>(
  saved: Record<string, unknown>,
  key: K,
): AppearanceSettings[K] {
  const value = saved[key] as AppearanceSettings[K];
  return CHOICES[key].includes(value) ? value : DEFAULT_APPEARANCE[key];
}

/** This device's appearance settings; anything missing, invalid or unreadable uses the default. */
export function loadAppearance(storage: SettingsStorage | null): AppearanceSettings {
  let saved: unknown = null;
  try {
    saved = JSON.parse(storage?.getItem(APPEARANCE_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  if (typeof saved !== 'object' || saved === null) return { ...DEFAULT_APPEARANCE };
  const s = saved as Record<string, unknown>;
  return { theme: pick(s, 'theme'), palette: pick(s, 'palette'), pattern: pick(s, 'pattern') };
}

/** Saves this device's appearance settings. Storage errors are ignored: the choice still applies. */
export function saveAppearance(storage: SettingsStorage | null, settings: AppearanceSettings) {
  try {
    storage?.setItem(APPEARANCE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or blocked site data: keep going without saving.
  }
}

/** The theme actually shown: System follows the device's dark mode setting. */
export function resolveTheme(choice: ThemeChoice, deviceIsDark: boolean): 'light' | 'dark' {
  if (choice === 'system') return deviceIsDark ? 'dark' : 'light';
  return choice;
}

/** Applies the settings as data attributes on the root element (design/themes.css reads them). */
export function applyAppearance(
  root: HTMLElement,
  settings: AppearanceSettings,
  deviceIsDark: boolean,
): void {
  const theme = resolveTheme(settings.theme, deviceIsDark);
  root.dataset.theme = theme;
  root.dataset.palette = settings.palette;
  root.dataset.pattern = settings.pattern;
  root.style.colorScheme = theme;
}
