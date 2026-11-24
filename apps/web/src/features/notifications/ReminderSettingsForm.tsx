import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import type { NotificationsApi, ReminderSettings } from './notificationsApi';

interface ReminderSettingsFormProps {
  api: NotificationsApi;
  studentId: string;
}

type TimeField =
  | 'quietStart'
  | 'quietEnd'
  | 'weekdayQuietStart'
  | 'weekdayQuietEnd'
  | 'sessionReminderTime'
  | 'streakReminderTime';

function TimeInput(props: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{props.label}</label>
      <input
        id={id}
        type="time"
        required
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="field field--inline">
      <input
        id={id}
        type="checkbox"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <label htmlFor={id}>{props.label}</label>
    </div>
  );
}

/** Parent screen: when a student may get reminders (quiet hours, school hours, which kinds). */
export function ReminderSettingsForm({ api, studentId }: ReminderSettingsFormProps) {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api.getReminderSettings(studentId).then(
      (s) => live && setSettings(s),
      () => live && setError("We couldn't load the reminder settings."),
    );
    return () => {
      live = false;
    };
  }, [api, studentId]);

  const set = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) => {
    setSaved(false);
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  };
  const time = (key: TimeField, label: string) => (
    <TimeInput label={label} value={settings![key]} onChange={(v) => set(key, v)} />
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    const { maxPerDay: _max, ...update } = settings;
    try {
      setSettings(await api.saveReminderSettings(studentId, update));
      setSaved(true);
    } catch {
      setError("We couldn't save the reminder settings. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Reminders">
      {error && <p role="alert">{error}</p>}
      {settings && (
        <form onSubmit={onSubmit} className="stack">
          <Toggle
            label="Send reminders"
            checked={settings.enabled}
            onChange={(v) => set('enabled', v)}
          />
          {settings.enabled && (
            <>
              <p>At most {settings.maxPerDay} reminders a day.</p>
              <Toggle
                label="Planned session reminders"
                checked={settings.sessionReminders}
                onChange={(v) => set('sessionReminders', v)}
              />
              {time('sessionReminderTime', 'Session reminder at')}
              <Toggle
                label="Streak reminders"
                checked={settings.streakReminders}
                onChange={(v) => set('streakReminders', v)}
              />
              {time('streakReminderTime', 'Streak reminder at')}
              <fieldset>
                <legend>Quiet at night</legend>
                {time('quietStart', 'Quiet from')}
                {time('quietEnd', 'Quiet until')}
              </fieldset>
              <fieldset>
                <legend>Quiet during school hours (Monday to Friday)</legend>
                {time('weekdayQuietStart', 'School day starts')}
                {time('weekdayQuietEnd', 'School day ends')}
              </fieldset>
            </>
          )}
          <Button type="submit" disabled={busy}>
            Save
          </Button>
          <p role="status">{saved ? 'Saved.' : ''}</p>
        </form>
      )}
    </Card>
  );
}
