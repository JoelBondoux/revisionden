import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { Avatar, Button } from '../../components';
import { useStudent } from '../../session/StudentContext';
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

  const { link } = state;
  const setUp = async () => {
    setBusy(true);
    try {
      const response = await register(link.options);
      const done = await api.verifyLink({ challengeId: link.challengeId, response });
      chooseStudent(done.student.id);
      navigate(afterLinkPath());
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
