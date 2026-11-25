import { Card } from '../../components/Card';
import { useReading } from './ReadingProvider';
import type { ReadingTextSize, ReadingTint } from './settings';

const SIZES: { value: ReadingTextSize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'larger', label: 'Larger' },
];

const TINTS: { value: ReadingTint; label: string }[] = [
  { value: 'none', label: 'No tint' },
  { value: 'cream', label: 'Cream' },
  { value: 'blue', label: 'Blue' },
];

/** The Reading comfort section in Settings: font, text size, spacing and tint, saved on this device. */
export function ReadingSettingsCard() {
  const { settings, update } = useReading();
  return (
    <Card title="Reading comfort">
      <div className="reading-settings">
        <label className="reading-settings__row">
          <input
            type="checkbox"
            checked={settings.font === 'dyslexic'}
            onChange={(e) => update({ font: e.target.checked ? 'dyslexic' : 'standard' })}
          />
          <span>Dyslexia-friendly font</span>
        </label>
        <fieldset className="reading-settings__choices">
          <legend>Text size</legend>
          {SIZES.map((s) => (
            <label key={s.value}>
              <input
                type="radio"
                name="reading-size"
                value={s.value}
                checked={settings.textSize === s.value}
                onChange={() => update({ textSize: s.value })}
              />
              <span>{s.label}</span>
            </label>
          ))}
        </fieldset>
        <label className="reading-settings__row">
          <input
            type="checkbox"
            checked={settings.spacing === 'wide'}
            onChange={(e) => update({ spacing: e.target.checked ? 'wide' : 'normal' })}
          />
          <span>More space between lines and letters</span>
        </label>
        <fieldset className="reading-settings__choices">
          <legend>Background tint</legend>
          {TINTS.map((t) => (
            <label key={t.value}>
              <input
                type="radio"
                name="reading-tint"
                value={t.value}
                checked={settings.tint === t.value}
                onChange={() => update({ tint: t.value })}
              />
              <span>{t.label}</span>
            </label>
          ))}
        </fieldset>
        <p className="secondary-text">
          Saved on this device and used on every screen. The font is OpenDyslexic, built into the
          app, so nothing is downloaded from another site.
        </p>
      </div>
    </Card>
  );
}
