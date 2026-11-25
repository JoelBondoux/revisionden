import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import type { RewardTier } from './rewardSounds';
import type { SoundVolume } from './settings';
import { useSound } from './SoundProvider';

const REWARD_SAMPLES: { tier: RewardTier; label: string }[] = [
  { tier: 'common', label: 'Common' },
  { tier: 'rare', label: 'Rare' },
  { tier: 'epic', label: 'Epic' },
  { tier: 'legendary', label: 'Legend' },
];

const VOLUMES: { value: SoundVolume; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

/** The Sound section in Settings: on/off, volume and tap sounds, saved on this device. */
export function SoundSettingsCard() {
  const { settings, update, play, sampleReward } = useSound();
  const off = !settings.enabled;
  return (
    <Card title="Sound">
      <div className="sound-settings">
        <label className="sound-settings__row">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          <span>Sound effects</span>
        </label>
        <fieldset className="sound-settings__volume" disabled={off}>
          <legend>Volume</legend>
          {VOLUMES.map((v) => (
            <label key={v.value}>
              <input
                type="radio"
                name="sound-volume"
                value={v.value}
                checked={settings.volume === v.value}
                onChange={() => update({ volume: v.value })}
              />
              <span>{v.label}</span>
            </label>
          ))}
        </fieldset>
        <label className="sound-settings__row">
          <input
            type="checkbox"
            checked={settings.taps}
            disabled={off}
            onChange={(e) => update({ taps: e.target.checked })}
          />
          <span>Tap sounds</span>
        </label>
        <p className="secondary-text">
          Saved on this device. On iPhone and iPad, sounds follow the silent switch.
        </p>
        <Button variant="secondary" disabled={off} onClick={() => play('correct')}>
          Play a sample
        </Button>
        <fieldset className="sound-settings__rewards" disabled={off}>
          <legend>Reward sounds</legend>
          <p className="secondary-text">Bigger rewards sound bigger. Tap again for another one.</p>
          <div className="sound-settings__samples">
            {REWARD_SAMPLES.map((s) => (
              <Button
                key={s.tier}
                variant="secondary"
                aria-label={`Play a ${s.label} reward sound`}
                onClick={() => sampleReward(s.tier)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </fieldset>
      </div>
    </Card>
  );
}
