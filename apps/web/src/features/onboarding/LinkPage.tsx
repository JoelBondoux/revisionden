import { useEffect, useId, useState, type FormEvent } from 'react';
import { formatLinkCode, normaliseLinkCode, type DeviceType } from '@revisionden/core';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { Avatar, Button } from '../../components';
import { LinkButton } from '../../components/links';
import { useStudent } from '../../session/StudentContext';
import { AvatarBuilder } from '../avatar/AvatarBuilder';
import type { LinkStart } from './api';
import { useOnboardingApi } from './OnboardingApiContext';
import { afterLinkPath } from '../legal/youngPeopleNotice';
import { saveDeviceMarker } from '../../session/deviceMarker';
import { rememberLastProblem } from '../feedback/details';
import {
  chromeIntentUrl,
  describePasskeyError,
  passkeyErrorName,
  passkeySupport,
  type PasskeyProblem,
} from './passkeyErrors';

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

/** What the page needs from the browser; tests pass their own. */
export interface LinkEnv {
  userAgent: string;
  /** Whether the browser has WebAuthn at all (window.PublicKeyCredential). */
  hasWebAuthn: boolean;
  /** True or false when the device can say whether it has a screen lock; undefined if unknown. */
  screenLock: () => Promise<boolean | undefined>;
  pageUrl: () => string;
  copy?: (text: string) => Promise<void>;
  now: () => number;
}

function browserEnv(): LinkEnv {
  const credential =
    typeof window === 'undefined'
      ? undefined
      : (window as { PublicKeyCredential?: typeof PublicKeyCredential }).PublicKeyCredential;
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  return {
    userAgent: nav?.userAgent ?? '',
    hasWebAuthn: typeof credential === 'function',
    screenLock: async () => {
      try {
        return await credential?.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        return undefined;
      }
    },
    pageUrl: () => window.location.href,
    ...(nav?.clipboard ? { copy: (text: string) => nav.clipboard.writeText(text) } : {}),
    now: () => Date.now(),
  };
}

/** The server's challenge lasts 5 minutes; after 4 the page fetches a fresh one before the tap. */
const CHALLENGE_FRESH_MS = 4 * 60 * 1000;

type RedeemInput = { token: string; familyId: string } | { code: string };

interface Problem {
  kind: PasskeyProblem;
  message: string;
  name: string;
  ref: string;
}

type State =
  | { status: 'enterCode'; error?: string }
  | { status: 'loading' }
  | {
      status: 'ready';
      link: LinkStart;
      input: RedeemInput;
      fetchedAt: number;
      problem?: Problem;
    }
  | { status: 'personalise'; nickname: string; avatarCode: string }
  | { status: 'failed'; message: string; problem?: Problem };

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

/**
 * Student device: opened from the parent's QR code or link, or a typed code. Opens the link,
 * then sets up a passkey. Opening it again is fine until the passkey is set up (E8), so a
 * reload or "Try again" always gets a fresh challenge.
 */
export function LinkPage({
  register = browserRegister,
  deviceType = detectDeviceType,
  env = browserEnv(),
}: {
  register?: RegisterPasskey;
  deviceType?: () => DeviceType;
  env?: LinkEnv;
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
  const [noScreenLock, setNoScreenLock] = useState(false);
  const support = passkeySupport(env);

  useEffect(() => {
    let live = true;
    env.screenLock().then(
      (available) => live && setNoScreenLock(available === false),
      () => undefined,
    );
    return () => {
      live = false;
    };
    // The environment is fixed for the page's lifetime, so this runs once.
  }, []);

  useEffect(() => {
    if (!token || !familyId) return;
    const input = { token, familyId };
    api.redeemLink(input).then(
      (link) => setState({ status: 'ready', link, input, fetchedAt: env.now() }),
      (err: unknown) =>
        setState({ status: 'failed', message: errorText(err, 'This code did not work.') }),
    );
  }, [api, token, familyId]);

  const redeemCode = (code: string) => {
    setState({ status: 'loading' });
    const input = { code };
    api.redeemLink(input).then(
      (link) => setState({ status: 'ready', link, input, fetchedAt: env.now() }),
      (err: unknown) =>
        setState({ status: 'enterCode', error: errorText(err, 'This code did not work.') }),
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
        {state.problem && <ProblemDetails problem={state.problem} />}
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

  const { link, input } = state;
  const setUp = async () => {
    setBusy(true);
    let current = link;
    let fetchedAt = state.fetchedAt;
    try {
      // A challenge close to its 5 minutes would fail on the server: get a fresh one first.
      if (env.now() - fetchedAt > CHALLENGE_FRESH_MS) {
        current = await api.redeemLink(input);
        fetchedAt = env.now();
      }
      const response = await register(current.options);
      const done = await api.verifyLink({
        challengeId: current.challengeId,
        response,
        deviceType: deviceType(),
      });
      saveDeviceMarker(done.deviceMarker);
      chooseStudent(done.student.id);
      setState({
        status: 'personalise',
        nickname: done.student.nickname,
        avatarCode: done.student.avatarCode,
      });
    } catch (err) {
      const name = passkeyErrorName(err);
      const { kind, message } = describePasskeyError(name);
      const problem = { kind, message, name, ref: api.reportPasskeyError(name) };
      // A parent's bug report from this screen carries the name and reference, nothing else.
      rememberLastProblem(`passkey:${name}:${problem.ref}`);
      if (kind === 'linkGone') {
        setState({ status: 'failed', message, problem });
        return;
      }
      // The challenge may be spent: fetch a fresh one now, so "Try again" works first time.
      try {
        current = await api.redeemLink(input);
        fetchedAt = env.now();
      } catch (refreshErr) {
        const gone = describePasskeyError(passkeyErrorName(refreshErr));
        if (gone.kind === 'linkGone') {
          setState({ status: 'failed', message: gone.message, problem });
          return;
        }
      }
      setState({ status: 'ready', link: current, input, fetchedAt, problem });
      setBusy(false);
    }
  };

  const blocked = support === 'no_webauthn';
  return (
    <div className="stack">
      <Avatar code={link.student.avatarCode} nickname={link.student.nickname} size={120} />
      <h1>Hi {link.student.nickname}!</h1>
      {support !== 'ok' && (
        <OpenInChrome env={env} code={'code' in input ? formatLinkCode(input.code) : undefined} />
      )}
      {!blocked && (
        <>
          <p>
            Set up a passkey to unlock RevisionDen on this device with your face, fingerprint or
            screen lock. No password needed.
          </p>
          {noScreenLock && (
            <p className="secondary-text">
              This device may not have a screen lock. A passkey needs a PIN, pattern, fingerprint or
              face unlock.
            </p>
          )}
          {state.problem && (
            <>
              <p role="alert" className="field__error">
                {state.problem.message}
              </p>
              <ProblemDetails problem={state.problem} />
              {state.problem.kind === 'alreadyLinked' && (
                <LinkButton to="/unlock" variant="secondary" block>
                  Unlock with my passkey
                </LinkButton>
              )}
            </>
          )}
          <Button block onClick={setUp} disabled={busy}>
            Set up passkey
          </Button>
        </>
      )}
    </div>
  );
}

/** The error name and reference code, for a parent's bug report or the support team. */
function ProblemDetails({ problem }: { problem: Problem }) {
  return (
    <p className="secondary-text">
      Details: {problem.name} ({problem.ref})
    </p>
  );
}

/** For in-app browsers and browsers without passkeys: open the same page in Chrome instead. */
function OpenInChrome({ env, code }: { env: LinkEnv; code?: string }) {
  const [copied, setCopied] = useState(false);
  const page = env.pageUrl();
  const intent = chromeIntentUrl(page, env.userAgent);
  const copy = env.copy;
  return (
    <section className="stack card" aria-labelledby="open-in-chrome">
      <h2 id="open-in-chrome" className="card__title">
        Open this page in Chrome
      </h2>
      <p>
        This browser may not be able to set up a passkey. Open the same link in Chrome (or Safari on
        an iPhone).
      </p>
      {code && (
        // A typed code is not in the page's link (it stays out of URLs), so show it to type again.
        <p>
          <span>In Chrome, enter your code again:</span>{' '}
          <strong className="link-code">{code}</strong>
        </p>
      )}
      {intent && (
        <LinkButton href={intent} block>
          Open in Chrome
        </LinkButton>
      )}
      {copy && (
        <Button
          variant="secondary"
          block
          onClick={() =>
            copy(page).then(
              () => setCopied(true),
              () => undefined,
            )
          }
        >
          Copy link
        </Button>
      )}
      {copied && <p aria-live="polite">Link copied. Paste it into Chrome.</p>}
    </section>
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
