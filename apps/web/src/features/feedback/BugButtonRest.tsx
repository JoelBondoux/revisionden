import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { useBugButton } from './bugButtonContext';
import { useFeedbackApi, type BugButtonInfo } from './feedbackApi';

/** "Tuesday 8 December", in UK time. */
function dayOf(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  }).format(new Date(iso));
}

const THANKS = 'Thanks for helping make RevisionDen better!';

/**
 * L13: in the student's Settings, a kind note while the bug button rests or is removed. No
 * blame; Get help and "Ask a parent" are never affected.
 */
export function BugButtonRestNote() {
  const { rest } = useBugButton();
  if (rest.state === 'on') return null;
  return (
    <p className="secondary-text" role="status">
      {rest.state === 'paused'
        ? `The bug button is taking a rest until ${dayOf(rest.until)}. ${THANKS}`
        : `The bug button is switched off for now. A parent can switch it back on. ${THANKS}`}
    </p>
  );
}

/** L13: in the parent area, a short note about a child's resting bug button, and a switch. */
export function ChildBugButtonNote({
  studentId,
  nickname,
}: {
  studentId: string;
  nickname: string;
}) {
  const api = useFeedbackApi();
  const [info, setInfo] = useState<BugButtonInfo>();
  const [switchedOn, setSwitchedOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // The child on screen now: a switch-on that finishes after the parent picks another child is
  // dropped, never shown for the new one.
  const current = useRef(studentId);
  current.current = studentId;

  useEffect(() => {
    let live = true;
    setSwitchedOn(false);
    setBusy(false);
    setFailed(false);
    api.childBugButton(studentId).then(
      (next) => live && setInfo(next),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [api, studentId]);

  if (switchedOn) return <p role="status">{`${nickname}'s bug button is back on.`}</p>;
  if (!info || info.state === 'on') return null;

  const switchOn = async () => {
    const forStudent = studentId;
    setBusy(true);
    setFailed(false);
    try {
      const next = await api.switchChildBugButtonOn(forStudent);
      if (current.current !== forStudent) return;
      setInfo(next);
      setSwitchedOn(true);
    } catch {
      if (current.current === forStudent) setFailed(true);
    } finally {
      if (current.current === forStudent) setBusy(false);
    }
  };

  return (
    <div className="stack">
      <p>
        {info.state === 'paused'
          ? `${nickname}'s bug button is taking a rest until ${dayOf(info.until)}, because several of their reports were not bugs.`
          : `${nickname}'s bug button is switched off, because many of their reports were not bugs.`}
      </p>
      <Button variant="secondary" disabled={busy} onClick={() => void switchOn()}>
        {`Switch ${nickname}'s bug button back on`}
      </Button>
      {failed && (
        <p role="alert" className="field__error">
          Could not switch it back on. Try again.
        </p>
      )}
    </div>
  );
}
