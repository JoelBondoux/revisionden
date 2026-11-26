import { describe, expect, it } from 'vitest';
import {
  chromeIntentUrl,
  describePasskeyError,
  inAppBrowser,
  passkeyErrorName,
  passkeySupport,
} from './passkeyErrors';

const dom = (name: string) => Object.assign(new Error('browser text, never shown'), { name });

describe('passkeyErrorName', () => {
  it('uses the browser error name', () => {
    expect(passkeyErrorName(dom('NotAllowedError'))).toBe('NotAllowedError');
  });

  it("uses SimpleWebAuthn's code when it has one", () => {
    const err = Object.assign(dom('InvalidStateError'), {
      code: 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED',
    });
    expect(passkeyErrorName(err)).toBe('ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED');
  });

  it("uses the API's error code for a server refusal", () => {
    expect(passkeyErrorName(Object.assign(new Error('x'), { code: 'invalid_challenge' }))).toBe(
      'invalid_challenge',
    );
  });

  it('never returns free text', () => {
    expect(passkeyErrorName('something odd happened')).toBe('UnknownError');
    expect(passkeyErrorName(Object.assign(new Error('x'), { name: 'Sam’s phone error' }))).toBe(
      'UnknownError',
    );
  });
});

describe('describePasskeyError', () => {
  it.each([
    ['NotAllowedError', 'retry'],
    ['AbortError', 'retry'],
    ['ERROR_CEREMONY_ABORTED', 'retry'],
    ['passkey_not_verified', 'retry'],
    ['invalid_challenge', 'retry'],
    ['InvalidStateError', 'alreadyLinked'],
    ['ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED', 'alreadyLinked'],
    ['ConstraintError', 'screenLock'],
    ['ERROR_AUTHENTICATOR_MISSING_USER_VERIFICATION_SUPPORT', 'screenLock'],
    ['NotSupportedError', 'unsupported'],
    ['SecurityError', 'unsupported'],
    ['ERROR_INVALID_DOMAIN', 'unsupported'],
    ['link_cancelled', 'linkGone'],
    ['link_already_used', 'linkGone'],
    ['invalid_link_token', 'linkGone'],
    ['UnknownError', 'retry'],
  ])('treats %s as %s', (name, kind) => {
    expect(describePasskeyError(name).kind).toBe(kind);
  });

  it('gives plain, friendly words', () => {
    expect(describePasskeyError('NotAllowedError').message).toBe(
      'Setting up the passkey was cancelled or took too long. Try again.',
    );
    expect(describePasskeyError('ConstraintError').message).toBe(
      'This device needs a screen lock first. Set up a PIN, pattern, fingerprint or face unlock in its settings, then try again.',
    );
    expect(describePasskeyError('InvalidStateError').message).toBe(
      'This device already has a passkey for you. Unlock with it instead.',
    );
    expect(describePasskeyError('NotSupportedError').message).toBe(
      'This browser cannot set up a passkey. Open this page in Chrome (or Safari on an iPhone).',
    );
  });
});

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';
const ANDROID_GOOGLE_APP = `${ANDROID_CHROME} GSA/15.47.30.29.arm64`;
const ANDROID_WEBVIEW =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9a; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36';
const INSTAGRAM = `${ANDROID_CHROME} Instagram 350.0.0.0`;
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

describe('inAppBrowser', () => {
  it('spots in-app browsers and web views', () => {
    for (const ua of [ANDROID_GOOGLE_APP, ANDROID_WEBVIEW, INSTAGRAM]) {
      expect(inAppBrowser(ua)).toBe(true);
    }
  });

  it('leaves real browsers alone', () => {
    expect(inAppBrowser(ANDROID_CHROME)).toBe(false);
    expect(inAppBrowser(IPHONE_SAFARI)).toBe(false);
  });
});

describe('passkeySupport', () => {
  it('needs WebAuthn and a real browser', () => {
    expect(passkeySupport({ hasWebAuthn: false, userAgent: ANDROID_CHROME })).toBe('no_webauthn');
    expect(passkeySupport({ hasWebAuthn: true, userAgent: ANDROID_GOOGLE_APP })).toBe(
      'in_app_browser',
    );
    expect(passkeySupport({ hasWebAuthn: true, userAgent: ANDROID_CHROME })).toBe('ok');
  });
});

describe('chromeIntentUrl', () => {
  it('opens the same page in Chrome on Android', () => {
    expect(
      chromeIntentUrl('https://dev.revisionden.com/link?token=abc&family=f1', ANDROID_GOOGLE_APP),
    ).toBe(
      'intent://dev.revisionden.com/link?token=abc&family=f1#Intent;scheme=https;package=com.android.chrome;end',
    );
  });

  it('is not offered off Android or for a page that is not https', () => {
    expect(chromeIntentUrl('https://dev.revisionden.com/link', IPHONE_SAFARI)).toBeNull();
    expect(chromeIntentUrl('http://localhost:5173/link', ANDROID_GOOGLE_APP)).toBeNull();
  });
});
