import { useCallback, useEffect, useState } from 'react';
import type { LinkToken, OnboardedChild } from '@revisionden/core';
import { Button } from '../../components';
import type { OnboardingApi } from './api';
import { ShareLink } from '../../pwa/ShareLink';
import { browserShareApis, type ShareApis } from '../../pwa/share';
import { QrCode } from './QrCode';

export type { ShareApis };

interface LinkDeviceStepProps {
  child: OnboardedChild;
  api: OnboardingApi;
  now?: () => Date;
  onDone: () => void;
  /** Injected in tests; defaults to the browser's share sheet and clipboard. */
  share?: ShareApis;
  /** How often to check whether the child's device has used the link. */
  pollMs?: number;
}

type State =
  | { status: 'loading' }
  | { status: 'ready'; token: LinkToken }
  | { status: 'error'; message: string };

type Shared =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; token: LinkToken }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const formatLeft = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** The message sent with a shared link: no nickname or other personal data. */
export const shareMessage = (linkUrl: string) => `Set up RevisionDen on your phone: ${linkUrl}`;

const typeAt = (linkUrl: string) => `${new URL(linkUrl).host}/link`;

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

/**
 * Parent links a child's device: a one-time QR code (10 minutes), or a link to send (24 hours),
 * each with a short code the child can type at /link. Both are single use. The screen updates
 * once the child's device has set up its passkey.
 */
export function LinkDeviceStep({
  child,
  api,
  now = () => new Date(),
  onDone,
  share = browserShareApis(typeof navigator === 'undefined' ? undefined : navigator),
  pollMs = 3000,
}: LinkDeviceStepProps) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [shared, setShared] = useState<Shared>({ status: 'none' });
  const [linked, setLinked] = useState(false);
  const [, setTick] = useState(0);
  const { nickname } = child.student;
  const studentId = child.student.id;

  const makeCode = useCallback(() => {
    setState({ status: 'loading' });
    api.createLinkToken(studentId, 'qr').then(
      (token) => setState({ status: 'ready', token }),
      (err: unknown) =>
        setState({ status: 'error', message: errorText(err, 'Could not make a code') }),
    );
  }, [api, studentId]);

  useEffect(makeCode, [makeCode]);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check every few seconds whether either link has been used to set up the device.
  const watching = [
    state.status === 'ready' ? state.token.tokenId : undefined,
    shared.status === 'ready' ? shared.token.tokenId : undefined,
  ].filter((id): id is string => Boolean(id));
  const watchKey = watching.join(',');
  useEffect(() => {
    if (linked || watchKey === '') return;
    let stopped = false;
    const ids = watchKey.split(',');
    const timer = setInterval(() => {
      for (const id of ids) {
        api.getLinkStatus(studentId, id).then(
          (status) => {
            if (!stopped && status === 'linked') setLinked(true);
          },
          () => undefined,
        );
      }
    }, pollMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [api, studentId, watchKey, linked, pollMs]);

  const sendLink = () => {
    setShared({ status: 'loading' });
    api.createLinkToken(studentId, 'share').then(
      (token) => setShared({ status: 'ready', token }),
      (err: unknown) =>
        setShared({ status: 'error', message: errorText(err, 'Could not make a link') }),
    );
  };

  const cancelShared = async (token: LinkToken) => {
    try {
      await api.cancelLink(studentId, token.tokenId);
      setShared({ status: 'cancelled' });
    } catch (err) {
      setShared({ status: 'error', message: errorText(err, 'Could not cancel the link') });
    }
  };

  if (linked) {
    return (
      <div className="stack link-step">
        <h1>{nickname}&apos;s device is set up</h1>
        <p>They can open RevisionDen on it now.</p>
        <Button block variant="success" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

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
            <p className="secondary-text">Or type this code at {typeAt(state.token.linkUrl)}:</p>
            <p className="link-code">{state.token.code}</p>
          </div>
        ) : (
          <>
            <p>This code has expired.</p>
            <Button onClick={makeCode}>Make a new code</Button>
          </>
        ))}

      <section className="stack link-share" aria-label="Send a link instead">
        {shared.status === 'none' && (
          <Button variant="secondary" onClick={sendLink}>
            Send a link instead
          </Button>
        )}
        {shared.status === 'loading' && <p aria-live="polite">Making a link…</p>}
        {shared.status === 'error' && (
          <p role="alert" className="field__error">
            {shared.message}
          </p>
        )}
        {shared.status === 'cancelled' && <p>Link cancelled. It will not work any more.</p>}
        {shared.status === 'ready' && (
          <>
            <p>Send this to {nickname} in a message. Works once, for 24 hours.</p>
            <ShareLink text={shareMessage(shared.token.linkUrl)} share={share} />
            <p className="secondary-text">
              Or {nickname} can type this code at {typeAt(shared.token.linkUrl)}:
            </p>
            <p className="link-code">{shared.token.code}</p>
            <p aria-live="polite">Waiting for {nickname}&apos;s device…</p>
            <Button variant="secondary" onClick={() => cancelShared(shared.token)}>
              Cancel this link
            </Button>
          </>
        )}
      </section>

      <Button block variant="success" onClick={onDone}>
        Done
      </Button>
      <Button block variant="secondary" onClick={onDone}>
        Do this later
      </Button>
    </div>
  );
}
