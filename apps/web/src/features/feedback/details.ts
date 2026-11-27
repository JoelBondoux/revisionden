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
  /**
   * F16: how the screen looked, so a layout or touch bug can be reproduced (L ruling in #392):
   * the look (effect style), light or dark, the background pattern, the screen's pixel density,
   * pinch zoom and the text size against 16px. Never the reading tint, the dyslexia-friendly
   * font or the colour-blind colours (or other reading or motion settings): they could hint at
   * a health condition.
   */
  look?: string;
  theme?: string;
  pattern?: string;
  pixelRatio?: number;
  zoom?: number;
  textScale?: number;
}

export type DisplayDetails = Pick<
  DeviceDetails,
  'look' | 'theme' | 'pattern' | 'pixelRatio' | 'zoom' | 'textScale'
>;

const SETTING = /^[a-z0-9-]{1,40}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * F16: the look, light or dark and the background pattern as the app sets them on the root
 * element, plus the screen's pixel density, pinch zoom and text size. Nothing that could hint at
 * a health condition (L ruling in #392), and anything that is not a plain setting name is left out.
 */
export function readDisplayDetails(
  root: HTMLElement,
  env: { pixelRatio: number; zoom: number; rootFontPx: number },
): DisplayDetails {
  const d = root.dataset;
  const setting = (value: string | undefined, fallback?: string) => {
    const v = value ?? fallback;
    return v && SETTING.test(v) ? v : undefined;
  };
  const named = {
    look: setting(d.effectStyle),
    theme: setting(d.theme, 'light'),
    pattern: setting(d.pattern, 'on'),
  };
  return {
    ...Object.fromEntries(Object.entries(named).filter(([, v]) => v !== undefined)),
    pixelRatio: round2(env.pixelRatio),
    zoom: round2(env.zoom),
    textScale: round2(env.rootFontPx / 16),
  };
}

/** The display details of this browser right now (F16). */
export function currentDisplayDetails(): DisplayDetails {
  const root = document.documentElement;
  return readDisplayDetails(root, {
    pixelRatio: window.devicePixelRatio || 1,
    zoom: window.visualViewport?.scale ?? 1,
    rootFontPx: parseFloat(getComputedStyle(root).fontSize) || 16,
  });
}

const PROBLEM_CODE = /^[A-Za-z0-9_:-]{1,80}$/;
/** F18: a remembered problem code is kept this long, so a report sent soon after still has it. */
export const LAST_PROBLEM_KEEP_MS = 15 * 60 * 1000;
let lastProblem: { code: string; at: number } | undefined;
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

/**
 * Remembers the last problem a screen showed, for the next bug report. Only short codes: an
 * error's reference code (F18: any `<ErrorRef>` on screen, "RD-…") or a sign-in problem (E8:
 * "passkey:NotAllowedError:RD-…"). A newer code replaces it; it is kept for 15 minutes.
 */
export function rememberLastProblem(code: string | undefined, now = Date.now()): void {
  lastProblem = code && PROBLEM_CODE.test(code) ? { code, at: now } : undefined;
}

/** Forgets the last problem code (F18: on sign-out, so the next person never sends it). */
export function forgetLastProblem(): void {
  lastProblem = undefined;
}

function currentProblem(now: number): string | undefined {
  if (!lastProblem || now - lastProblem.at > LAST_PROBLEM_KEEP_MS) return undefined;
  return lastProblem.code;
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

export function collectDeviceDetails(
  input: {
    appVersion: string;
    route: string;
    userAgent: string;
    width: number;
    height: number;
    online: boolean;
  },
  now = Date.now(),
): DeviceDetails {
  const problem = currentProblem(now);
  return {
    appVersion: input.appVersion,
    route: input.route,
    browserFamily: browserFamily(input.userAgent),
    screenSize: `${Math.round(input.width)}x${Math.round(input.height)}`,
    online: input.online,
    ...(problem ? { lastProblem: problem } : {}),
    ...(onScreen ? { contentId: onScreen } : {}),
  };
}
