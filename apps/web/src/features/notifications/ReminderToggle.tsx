import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import type { NotificationsApi } from './notificationsApi';
import {
  currentReminderState,
  disableReminders,
  enableReminders,
  pushSupport,
  type PushEnvironment,
  type ReminderState,
} from './push';

interface ReminderToggleProps {
  env: PushEnvironment;
  api: NotificationsApi;
}

/**
 * Lets a student turn reminders on for this device. The browser's permission prompt only
 * appears after the button is pressed, never on page load.
 */
export function ReminderToggle({ env, api }: ReminderToggleProps) {
  const support = pushSupport(env);
  const [state, setState] = useState<ReminderState | 'loading'>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (support !== 'ok') return;
    let live = true;
    void currentReminderState(env).then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [env, support]);

  async function change(action: typeof enableReminders, failure: string) {
    setBusy(true);
    setError(null);
    try {
      setState(await action(env, api));
    } catch {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  let body;
  if (support === 'needs-install') {
    body = (
      <p>
        On iPhone and iPad, reminders work once RevisionDen is on your Home Screen.{' '}
        <Link to="/install">Add to Home Screen</Link>
      </p>
    );
  } else if (support === 'unsupported') {
    body = <p>This browser can't show reminders.</p>;
  } else if (state === 'blocked') {
    body = (
      <p>
        Notifications are blocked for RevisionDen. To get reminders, allow notifications in your
        browser or device settings.
      </p>
    );
  } else if (state === 'on') {
    body = (
      <>
        <p>Reminders are on for this device.</p>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => change(disableReminders, "We couldn't turn off reminders. Try again.")}
        >
          Turn off
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <p>
          A nudge for planned sessions and your streak: at most 2 a day, never at night or during
          school hours.
        </p>
        <Button
          disabled={busy || state === 'loading'}
          onClick={() => change(enableReminders, "We couldn't turn on reminders. Try again later.")}
        >
          Turn on reminders
        </Button>
      </>
    );
  }

  return (
    <Card title="Reminders">
      {body}
      {error && <p role="alert">{error}</p>}
    </Card>
  );
}
