import { useEffect, useId, useState, type FormEvent } from 'react';
import { formatLinkCode, normaliseLinkCode, type DeviceType } from '@revisionden/core';
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

/** A coarse device type for the parent's device list; never the browser or model. */
export function detectDeviceType(): DeviceType {
  const touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
  const width =
    typeof window !== 'undefined' ? Math.min(window.screen.width, window.screen.height) : 0;
  if (!touch) return 'computer';
  return width >= 600 ? 'tablet' : 'phone';
}

type State =
  | { status: 'enterCode'; error?: string }
  | { status: 'loading' }
  | { status: 'ready'; link: LinkStart; error?: string }
  | { status: 'failed'; message: string };

/** Student device: opened from the parent's QR code. Redeems the code, then sets up a passkey. */
export function LinkPage({
  register = browserRegister,
  deviceType = detectDeviceType,
}: {
  register?: RegisterPasskey;
  deviceType?: () => DeviceType;
}) {
  const api = useOnboardingApi();
  const navigate = useNavigate();
  const { chooseStudent } = useStudent();
  const [params] = useSearchParams();
  const token = params.get('token');
  const familyId = params.get('family');
  const [state, setState] = useState<State>(
    token && familyId ? { status: 'loading' } : { status: 'enterCode' },
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token || !familyId) return;
    api.redeemLink({ token, familyId }).then(
      (link) => setState({ status: 'ready', link }),
      (err: unknown) =>
        setState({
          status: 'failed',
          message: err instanceof Error ? err.message : 'This code did not work.',
        }),
    );
  }, [api, token, familyId]);

  const redeemCode = (code: string) => {
    setState({ status: 'loading' });
    api.redeemLink({ code }).then(
      (link) => setState({ status: 'ready', link }),
      (err: unknown) =>
        setState({
          status: 'enterCode',
          error: err instanceof Error ? err.message : 'This code did not work.',
        }),
    );
  };

  if (state.status === 'enterCode') {
    return <EnterCode error={state.error} onCode={redeemCode} />;
  }
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
      const done = await api.verifyLink({
        challengeId: link.challengeId,
        response,
        deviceType: deviceType(),
      });
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

/** For devices where the camera or link is awkward: type the short code a parent was shown. */
function EnterCode({ error, onCode }: { error?: string; onCode: (code: string) => void }) {
  const id = useId();
  const [value, setValue] = useState('');
  const [problem, setProblem] = useState<string>();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const code = normaliseLinkCode(value);
    if (!code) {
      setProblem(
        `That does not look like a code. It has 8 letters and numbers, like ${formatLinkCode('ABCDEFGH')}.`,
      );
      return;
    }
    setProblem(undefined);
    onCode(code);
  };
  const message = problem ?? error;
  return (
    <form className="stack" onSubmit={submit} noValidate>
      <h1>Link this device</h1>
      <p>Scan the QR code a parent shows you, open the link they sent, or type their code here.</p>
      <div className="field">
        <label htmlFor={id} className="field__label">
          Code from your parent
        </label>
        <input
          id={id}
          className="field__input link-code-input"
          value={value}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={12}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {message && (
        <p role="alert" className="field__error">
          {message}
        </p>
      )}
      <Button type="submit" block>
        Continue
      </Button>
    </form>
  );
}
