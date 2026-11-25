import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import {
  currentReminderState,
  disableReminders,
  enableReminders,
  pushSupport,
  type PushApi,
  type PushAudience,
  type PushEnvironment,
  type ReminderState,
} from './push';

interface ReminderToggleProps {
  env: PushEnvironment;
  api: PushApi;
  /** 'parent': reward news on the parent's own device (workstream H2). */
  audience?: PushAudience;
}

const WORDING = {
  student: {
    title: 'Reminders',
    what: 'reminders',
    on: 'Reminders are on for this device.',
    offer:
      'A nudge for planned sessions and your streak: at most 2 a day, never at night or during school hours.',
    button: 'Turn on reminders',
  },
  parent: {
    title: 'Reward news',
    what: 'reward news',
    on: 'Reward news is on for this device.',
    offer:
      'A notification on this device when a child meets a reward target you set: once per reward, never during their night-time quiet hours.',
    button: 'Turn on reward news',
  },
} as const;

/**
 * Lets a student turn reminders on for this device. The browser's permission prompt only
 * appears after the button is pressed, never on page load.
 */
export function ReminderToggle({ env, api, audience = 'student' }: ReminderToggleProps) {
  const words = WORDING[audience];
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
        On iPhone and iPad, {words.what} works once RevisionDen is on your Home Screen.{' '}
        <Link to="/install">Add to Home Screen</Link>
      </p>
    );
  } else if (support === 'unsupported') {
    body = <p>This browser can&apos;t show {words.what}.</p>;
  } else if (state === 'blocked') {
    body = (
      <p>
        Notifications are blocked for RevisionDen. To get {words.what}, allow notifications in your
        browser or device settings.
      </p>
    );
  } else if (state === 'on') {
    body = (
      <>
        <p>{words.on}</p>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => change(disableReminders, `We couldn't turn off ${words.what}. Try again.`)}
        >
          Turn off
        </Button>
      </>
    );
  } else {
    body = (
      <>
        <p>{words.offer}</p>
        <Button
          disabled={busy || state === 'loading'}
          onClick={() =>
            change(
              (e, a) => enableReminders(e, a, audience),
              `We couldn't turn on ${words.what}. Try again later.`,
            )
          }
        >
          {words.button}
        </Button>
      </>
    );
  }

  return (
    <Card title={words.title}>
      {body}
      {error && <p role="alert">{error}</p>}
    </Card>
  );
}
