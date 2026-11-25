import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startAuthentication } from '@simplewebauthn/browser';
import { Button } from '../../components';
import { ErrorRef, refOf, type ErrorDetails } from '../../api/ErrorRef';
import { safeReturnTo } from '../../api/unlock';
import { useStudent } from '../../session/StudentContext';
import { OnboardingApiError } from './api';
import { useOnboardingApi } from './OnboardingApiContext';

/** The browser's passkey prompt. An object so tests can stub it. */
export const passkeyBrowser = {
  authenticate: (options: Record<string, unknown>): Promise<unknown> =>
    startAuthentication({ optionsJSON: options as never }),
};

type Failure = { kind: 'no-passkey' } | { kind: 'other'; ref: ErrorDetails | undefined };

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
 * for face, fingerprint or screen lock, then starts a new 12-hour student session.
 */
export function StudentUnlock({ label, returnTo }: { label: string; returnTo?: string | null }) {
  const api = useOnboardingApi();
  const navigate = useNavigate();
  const { chooseStudent } = useStudent();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const unlock = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const start = await api.unlockOptions();
      const response = await passkeyBrowser.authenticate(start.options);
      const done = await api.unlockVerify({ challengeId: start.challengeId, response });
      chooseStudent(done.student.id);
      navigate(safeReturnTo(returnTo), { replace: true });
    } catch (err) {
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
      <Button block variant="secondary" disabled={busy} onClick={() => void unlock()}>
        {label}
      </Button>
    </div>
  );
}
