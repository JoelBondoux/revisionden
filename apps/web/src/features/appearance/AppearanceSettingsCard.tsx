import { Card } from '../../components/Card';
import { useAppearance } from './AppearanceProvider';
import type { Palette, ThemeChoice } from './settings';

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const PALETTES: { value: Palette; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'colourblind', label: 'Colour-blind friendly' },
];

/** The Appearance section in Settings: theme, colours and background pattern, saved on this device. */
export function AppearanceSettingsCard() {
  const { settings, update } = useAppearance();
  return (
    <Card title="Appearance">
      <div className="reading-settings">
        <fieldset className="reading-settings__choices">
          <legend>Theme</legend>
          {THEMES.map((t) => (
            <label key={t.value}>
              <input
                type="radio"
                name="appearance-theme"
                value={t.value}
                checked={settings.theme === t.value}
                onChange={() => update({ theme: t.value })}
              />
              <span>{t.label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="reading-settings__choices">
          <legend>Colours</legend>
          {PALETTES.map((p) => (
            <label key={p.value}>
              <input
                type="radio"
                name="appearance-palette"
                value={p.value}
                checked={settings.palette === p.value}
                onChange={() => update({ palette: p.value })}
              />
              <span>{p.label}</span>
            </label>
          ))}
        </fieldset>
        <label className="reading-settings__row">
          <input
            type="checkbox"
            checked={settings.pattern === 'on'}
            onChange={(e) => update({ pattern: e.target.checked ? 'on' : 'off' })}
          />
          <span>Background pattern</span>
        </label>
        <p className="secondary-text">
          System follows your device&apos;s light or dark mode. Colour-blind friendly shows right
          answers in blue and wrong ones in orange, and icons and words always say it too. Saved on
          this device.
        </p>
      </div>
    </Card>
  );
}
