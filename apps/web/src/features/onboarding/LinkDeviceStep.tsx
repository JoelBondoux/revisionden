import { useCallback, useEffect, useState } from 'react';
import type { LinkToken, OnboardedChild } from '@revisionden/core';
import { Button } from '../../components';
import type { OnboardingApi } from './api';
import { QrCode } from './QrCode';

interface LinkDeviceStepProps {
  child: OnboardedChild;
  api: OnboardingApi;
  now?: () => Date;
  onDone: () => void;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; token: LinkToken }
  | { status: 'error'; message: string };

const formatLeft = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Parent shows a one-time QR code (10 minutes, single use) for the child's device to scan. */
export function LinkDeviceStep({
  child,
  api,
  now = () => new Date(),
  onDone,
}: LinkDeviceStepProps) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [, setTick] = useState(0);
  const { nickname } = child.student;

  const makeCode = useCallback(() => {
    setState({ status: 'loading' });
    api.createLinkToken(child.student.id).then(
      (token) => setState({ status: 'ready', token }),
      (err: unknown) =>
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Could not make a code',
        }),
    );
  }, [api, child.student.id]);

  useEffect(makeCode, [makeCode]);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = state.status === 'ready' ? Date.parse(state.token.expiresAt) - now().getTime() : 0;

  return (
    <div className="stack link-step">
      <h1>Link {nickname}&apos;s device</h1>
      <p>
        On {nickname}&apos;s phone or tablet, open the camera and scan this code. They then set up a
        passkey, so there is no password to remember.
      </p>
      {state.status === 'loading' && <p aria-live="polite">Making a code…</p>}
      {state.status === 'error' && (
        <>
          <p role="alert" className="field__error">
            {state.message}
          </p>
          <Button onClick={makeCode}>Try again</Button>
        </>
      )}
      {state.status === 'ready' &&
        (left > 0 ? (
          <div className="link-step__code">
            <QrCode value={state.token.linkUrl} label={`QR code to link ${nickname}'s device`} />
            <p className="secondary-text">Works once, for {formatLeft(left)} more</p>
          </div>
        ) : (
          <>
            <p>This code has expired.</p>
            <Button onClick={makeCode}>Make a new code</Button>
          </>
        ))}
      <Button block variant="success" onClick={onDone}>
        Done
      </Button>
      <Button block variant="secondary" onClick={onDone}>
        Do this later
      </Button>
    </div>
  );
}
