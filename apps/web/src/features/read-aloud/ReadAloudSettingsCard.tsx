import { Card } from '../../components/Card';
import { useReadAloud } from './ReadAloudProvider';
import { RATES, type ReadAloudRate } from './settings';

const RATE_LABELS: Record<ReadAloudRate, string> = { 0.75: 'Slower', 1: 'Normal', 1.25: 'Faster' };

function voiceNote(supported: boolean, onDevice: boolean | null): string {
  if (!supported || onDevice === null) {
    return "This device can't read aloud: it has no English speech voice.";
  }
  if (onDevice) return 'Uses a voice on this device, so the text stays on this device.';
  return (
    'This device only has online voices, so its speech service may process the text it reads ' +
    '(questions, answers and your flashcards). That is why read aloud starts off here.'
  );
}

/** The Read aloud section in Settings: on/off and speed, saved on this device. */
export function ReadAloudSettingsCard() {
  const { supported, voice, settings, on, update } = useReadAloud();
  const unavailable = !supported || voice === null;
  return (
    <Card title="Read aloud">
      <div className="read-aloud-settings">
        <label className="read-aloud-settings__row">
          <input
            type="checkbox"
            checked={on}
            disabled={unavailable}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <span>Read aloud</span>
        </label>
        <fieldset className="read-aloud-settings__choices" disabled={unavailable || !on}>
          <legend>Speed</legend>
          {RATES.map((rate) => (
            <label key={rate}>
              <input
                type="radio"
                name="read-aloud-rate"
                value={rate}
                checked={settings.rate === rate}
                onChange={() => update({ rate })}
              />
              <span>{RATE_LABELS[rate]}</span>
            </label>
          ))}
        </fieldset>
        <p className="secondary-text">
          {voiceNote(supported, voice ? voice.onDevice : null)} Adds a speaker button to questions,
          answers, explanations and flashcards. Saved on this device.
        </p>
      </div>
    </Card>
  );
}
