/**
 * Passkey set-up on a child's device (E8): turns what went wrong into plain words, and spots
 * browsers that cannot set up a passkey before the child taps the button. Only error names and
 * codes are used, never the browser's own message (it can hold device details).
 */

export type PasskeyProblem =
  | 'retry'
  | 'screenLock'
  | 'alreadyLinked'
  | 'unsupported'
  /** The link was cancelled, used or has expired: a parent needs to make a new one. */
  | 'linkGone';

const SAFE_NAME = /^[A-Za-z0-9_]{1,60}$/;

/** The error's name or code, for the "Details" line and error reports; never free text. */
export function passkeyErrorName(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'UnknownError';
  const { code, name } = err as { code?: unknown; name?: unknown };
  // SimpleWebAuthn's WebAuthnError and our API errors both carry a code; prefer it.
  if (typeof code === 'string' && SAFE_NAME.test(code)) return code;
  if (typeof name === 'string' && SAFE_NAME.test(name) && name !== 'Error') return name;
  return 'UnknownError';
}

const KINDS: Record<string, PasskeyProblem> = {
  NotAllowedError: 'retry',
  AbortError: 'retry',
  ERROR_CEREMONY_ABORTED: 'retry',
  passkey_not_verified: 'retry',
  invalid_challenge: 'retry',
  InvalidStateError: 'alreadyLinked',
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: 'alreadyLinked',
  ConstraintError: 'screenLock',
  ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT: 'screenLock',
  ERROR_AUTHENTICATOR_MISSING_DISCOVERABLE_CREDENTIAL_SUPPORT: 'unsupported',
  ERROR_AUTHENTICATOR_NO_SUPPORTED_PUBKEYCREDPARAMS_ALG: 'unsupported',
  NotSupportedError: 'unsupported',
  SecurityError: 'unsupported',
  ERROR_INVALID_DOMAIN: 'unsupported',
  ERROR_INVALID_RP_ID: 'unsupported',
  link_cancelled: 'linkGone',
  link_already_used: 'linkGone',
  invalid_link_token: 'linkGone',
};

const MESSAGES: Record<PasskeyProblem, string> = {
  retry: 'Setting up the passkey was cancelled or took too long. Try again.',
  screenLock:
    'This device needs a screen lock first. Set up a PIN, pattern, fingerprint or face unlock in its settings, then try again.',
  alreadyLinked: 'This device already has a passkey for you. Unlock with it instead.',
  unsupported:
    'This browser cannot set up a passkey. Open this page in Chrome (or Safari on an iPhone).',
  linkGone: 'This link no longer works. Ask a parent to make a new one.',
};

export function describePasskeyError(name: string): { kind: PasskeyProblem; message: string } {
  const kind = KINDS[name] ?? 'retry';
  return { kind, message: MESSAGES[kind] };
}

/**
 * In-app browsers and web views (the Google app and Lens, Instagram, Facebook, TikTok and the
 * like) often cannot make passkeys. Matched on the user agent; only the answer is kept.
 */
const IN_APP =
  /; wv\)|\bGSA\/|Instagram|FBAN|FBAV|FB_IAB|Snapchat|musical_ly|BytedanceWebview|TikTok|\bLine\/|Twitter/i;

export const inAppBrowser = (userAgent: string) => IN_APP.test(userAgent);

export type PasskeySupport = 'ok' | 'no_webauthn' | 'in_app_browser';

export function passkeySupport(env: { hasWebAuthn: boolean; userAgent: string }): PasskeySupport {
  if (!env.hasWebAuthn) return 'no_webauthn';
  if (inAppBrowser(env.userAgent)) return 'in_app_browser';
  return 'ok';
}

/** An Android link that opens this same https page in Chrome, or null where it does not apply. */
export function chromeIntentUrl(pageUrl: string, userAgent: string): string | null {
  if (!/Android/i.test(userAgent)) return null;
  const url = new URL(pageUrl);
  if (url.protocol !== 'https:') return null;
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=https;package=com.android.chrome;end`;
}
