import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { Avatar, Button } from '../../components';
import { useStudent } from '../../session/StudentContext';
import { AvatarBuilder } from '../avatar/AvatarBuilder';
import type { LinkStart } from './api';
import { useOnboardingApi } from './OnboardingApiContext';
import { afterLinkPath } from '../legal/youngPeopleNotice';

/** Creates a passkey on this device from the server's options; returns the browser's answer. */
export type RegisterPasskey = (options: Record<string, unknown>) => Promise<unknown>;

const browserRegister: RegisterPasskey = (options) =>
  startRegistration({ optionsJSON: options as never });

type State =
  | { status: 'loading' }
  | { status: 'ready'; link: LinkStart; error?: string }
  | { status: 'personalise'; nickname: string; avatarCode: string }
  | { status: 'failed'; message: string };

/** Student device: opened from the parent's QR code. Redeems the code, then sets up a passkey. */
export function LinkPage({ register = browserRegister }: { register?: RegisterPasskey }) {
  const api = useOnboardingApi();
  const navigate = useNavigate();
  const { chooseStudent } = useStudent();
  const [params] = useSearchParams();
  const token = params.get('token');
  const familyId = params.get('family');
  const [state, setState] = useState<State>({ status: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !familyId) {
      setState({
        status: 'failed',
        message: 'This link is missing its code. Scan the QR code again.',
      });
      return;
    }
    api.redeemLink({ token, familyId }).then(
      (link) => setState({ status: 'ready', link }),
      (err: unknown) =>
        setState({
          status: 'failed',
          message: err instanceof Error ? err.message : 'This code did not work.',
        }),
    );
  }, [api, token, familyId]);

  if (state.status === 'loading') return <p aria-live="polite">Checking the code…</p>;
  if (state.status === 'failed') {
    return (
      <div className="stack">
        <h1>Link this device</h1>
        <p role="alert" className="field__error">
          {state.message}
        </p>
      </div>
    );
  }

  if (state.status === 'personalise') {
    return (
      <MakeItYours
        nickname={state.nickname}
        startCode={state.avatarCode}
        save={(code) => api.saveMyAvatar(code)}
        onDone={() => navigate(afterLinkPath())}
      />
    );
  }

  const { link } = state;
  const setUp = async () => {
    setBusy(true);
    try {
      const response = await register(link.options);
      const done = await api.verifyLink({ challengeId: link.challengeId, response });
      chooseStudent(done.student.id);
      setState({
        status: 'personalise',
        nickname: done.student.nickname,
        avatarCode: done.student.avatarCode,
      });
    } catch {
      setState({ status: 'ready', link, error: 'The passkey was not set up. Try again.' });
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <Avatar code={link.student.avatarCode} nickname={link.student.nickname} size={120} />
      <h1>Hi {link.student.nickname}!</h1>
      <p>
        Set up a passkey to unlock RevisionDen on this device with your face, fingerprint or screen
        lock. No password needed.
      </p>
      {state.error && (
        <p role="alert" className="field__error">
          {state.error}
        </p>
      )}
      <Button block onClick={setUp} disabled={busy}>
        Set up passkey
      </Button>
    </div>
  );
}

interface MakeItYoursProps {
  nickname: string;
  startCode: string;
  save: (avatarCode: string) => Promise<unknown>;
  onDone: () => void;
}

/** First open on a newly linked device: the student can change the look their parent picked. */
function MakeItYours({ nickname, startCode, save, onDone }: MakeItYoursProps) {
  const [code, setCode] = useState(startCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await save(code);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your avatar.');
      setSaving(false);
    }
  };
  return (
    <div className="stack">
      <h1>Make it yours</h1>
      <p>Change anything you like. You can always come back to it later.</p>
      <AvatarBuilder code={code} nickname={nickname} onChange={setCode} />
      {error && (
        <p role="alert" className="field__error">
          {error}
        </p>
      )}
      <Button block onClick={submit} disabled={saving}>
        Save my avatar
      </Button>
      <Button block variant="secondary" onClick={onDone}>
        Maybe later
      </Button>
    </div>
  );
}
