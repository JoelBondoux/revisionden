import { useEffect } from 'react';

/** The device details a feedback report may include (never IP address, location or contacts). */
export interface DeviceDetails {
  appVersion: string;
  route: string;
  browserFamily: string;
  screenSize: string;
  online: boolean;
  /** The last problem this page saw, as a short code only (E8: "passkey:NotAllowedError:RD-…"). */
  lastProblem?: string;
  /**
   * F16: the content id of the question or deck card on screen (for example
   * gcse-maths-h-n4-0001), so the content team can find it. Never its text, and never a
   * student's own card.
   */
  contentId?: string;
}

const PROBLEM_CODE = /^[A-Za-z0-9_:-]{1,80}$/;
let lastProblem: string | undefined;
const CONTENT_ID = /^[A-Za-z0-9_-]{1,80}$/;
let onScreen: string | undefined;

/** Remembers the question or deck card on screen for the next bug report (F16). Ids only. */
export function rememberOnScreen(contentId: string | undefined): void {
  onScreen = contentId && CONTENT_ID.test(contentId) ? contentId : undefined;
}

/** Names the question or deck card on screen while the calling screen shows it (F16). */
export function useOnScreenContent(contentId: string | undefined): void {
  useEffect(() => {
    rememberOnScreen(contentId);
    return () => rememberOnScreen(undefined);
  }, [contentId]);
}

/** Remembers the last problem a screen showed, for the next bug report. Only short codes. */
export function rememberLastProblem(code: string | undefined): void {
  lastProblem = code && PROBLEM_CODE.test(code) ? code : undefined;
}

// The same patterns as the API's privacy filter (apps/api/src/ai/privacy.ts). The API also
// refuses the student's nickname; this is only an early, friendly check.
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(\+44\s?7\d{3}|\b07\d{3})\s?\d{3}\s?\d{3}\b/;

export const PERSONAL_DETAILS_MESSAGE =
  'Please leave out personal details like names, email addresses and phone numbers.';

export function findPersonalDetails(text: string): boolean {
  return EMAIL.test(text) || PHONE.test(text);
}

/** Browser family only (no version), from the user agent. */
export function browserFamily(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/Firefox\/|FxiOS\//.test(userAgent)) return 'Firefox';
  if (/Chrome\/|CriOS\//.test(userAgent)) return 'Chrome';
  if (/Safari\//.test(userAgent)) return 'Safari';
  return 'Other';
}

export function collectDeviceDetails(input: {
  appVersion: string;
  route: string;
  userAgent: string;
  width: number;
  height: number;
  online: boolean;
}): DeviceDetails {
  return {
    appVersion: input.appVersion,
    route: input.route,
    browserFamily: browserFamily(input.userAgent),
    screenSize: `${Math.round(input.width)}x${Math.round(input.height)}`,
    online: input.online,
    ...(lastProblem ? { lastProblem } : {}),
    ...(onScreen ? { contentId: onScreen } : {}),
  };
}
