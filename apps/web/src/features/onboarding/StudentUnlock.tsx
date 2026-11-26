import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { Button } from '../../components';
import { ErrorRef, refOf, type ErrorDetails } from '../../api/ErrorRef';
import { safeReturnTo } from '../../api/unlock';
import { useStudent } from '../../session/StudentContext';
import { readDeviceMarker, saveDeviceMarker } from '../../session/deviceMarker';
import { rememberLastProblem } from '../feedback/details';
import type { DeviceType } from '@revisionden/core';
import { OnboardingApiError } from './api';
import { detectDeviceType } from './LinkPage';
import { useOnboardingApi } from './OnboardingApiContext';
import { describePhoneError, passkeyErrorName } from './passkeyErrors';

/** The browser's passkey prompt. An object so tests can stub it. */
export const passkeyBrowser = {
  authenticate: (options: Record<string, unknown>): Promise<unknown> =>
    startAuthentication({ optionsJSON: options as never }),
};

/** What kind of device this is; an object so tests can stub it. */
export const unlockEnv = {
  deviceType: (): DeviceType => detectDeviceType(),
};

type Failure =
  | { kind: 'no-passkey' }
  | { kind: 'other'; ref: ErrorDetails | undefined }
  /** E10: signing in with the phone failed; `name` and `ref` make up the Details line. */
  | { kind: 'phone'; message: string; notLinked: boolean; name: string; ref: string };

/**
 * The passkey cannot be used here: none on this device, the student cancelled (browsers report
 * both the same way, on purpose), or a parent unlinked the device so the server no longer knows it.
 */
function isNoPasskey(err: unknown): boolean {
  if (err instanceof OnboardingApiError) return err.code === 'passkey_not_verified';
  const name = (err as { name?: unknown } | null)?.name;
  return name === 'NotAllowedError' || name === 'InvalidStateError' || name === 'SecurityError';
}

/**
 * "Unlock with my passkey" for a student device (I5): asks the API for a challenge with no
 * credential ids (so any RevisionDen passkey on this device can answer), lets the browser prompt
 * for face, fingerprint or screen lock, then starts a new 12-hour student session. On a computer
 * or tablet, or once no passkey was found, "Use my phone instead" (E10) does the same with the
 * passkey on the student's phone: the browser shows a QR code to scan (WebAuthn hybrid).
 */
export function StudentUnlock({ label, returnTo }: { label: string; returnTo?: string | null }) {
  const api = useOnboardingApi();
  const navigate = useNavigate();
  const { chooseStudent } = useStudent();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [onPhone] = useState(() => unlockEnv.deviceType() === 'phone');
  // E10: offered on computers and tablets, and anywhere once no passkey was found.
  const offerPhone = !onPhone || failure !== null;

  const phoneFailure = (err: unknown): Failure => {
    const name = passkeyErrorName(err);
    const { kind, message } = describePhoneError(name);
    const ref = api.reportPasskeyError(name, '/unlock');
    rememberLastProblem(`phone:${name}:${ref}`);
    return { kind: 'phone', message, notLinked: kind === 'notLinked', name, ref };
  };

  const unlock = async (usePhone = false) => {
    setBusy(true);
    setFailure(null);
    try {
      const start = await api.unlockOptions(usePhone ? { usePhone: true } : undefined);
      const response = await passkeyBrowser.authenticate(start.options);
      const deviceMarker = readDeviceMarker();
      const done = await api.unlockVerify({
        challengeId: start.challengeId,
        response,
        ...(deviceMarker ? { deviceMarker } : {}),
      });
      saveDeviceMarker(done.deviceMarker);
      chooseStudent(done.student.id);
      navigate(safeReturnTo(returnTo), { replace: true });
    } catch (err) {
      if (usePhone) setFailure(phoneFailure(err));
      else
        setFailure(isNoPasskey(err) ? { kind: 'no-passkey' } : { kind: 'other', ref: refOf(err) });
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      {failure?.kind === 'no-passkey' && (
        <div role="alert">
          <p>No RevisionDen passkey was found on this device.</p>
          <p>Ask a parent to link this device.</p>
        </div>
      )}
      {failure?.kind === 'other' && (
        <div role="alert">
          <p>We could not unlock RevisionDen. Please try again.</p>
          <ErrorRef code={failure.ref} />
        </div>
      )}
      {failure?.kind === 'phone' && (
        <div role="alert">
          <p>{failure.message}</p>
          {failure.notLinked && <p>Ask a parent to link this device.</p>}
          <p className="secondary-text">
            Details: {failure.name} ({failure.ref})
          </p>
        </div>
      )}
      <Button block variant="secondary" disabled={busy} onClick={() => void unlock()}>
        {label}
      </Button>
      {offerPhone && (
        <>
          <Button block variant="secondary" disabled={busy} onClick={() => void unlock(true)}>
            Use my phone instead
          </Button>
          <p className="secondary-text">
            Your browser shows a QR code. Scan it with the phone you use for RevisionDen.
          </p>
        </>
      )}
    </div>
  );
}
