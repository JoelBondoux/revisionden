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
   * F16: how the screen looked, so a layout or touch bug can be reproduced. Settings and sizes
   * only, never personal: the look (effect style), light or dark, colours, background pattern,
   * reading settings, the screen's pixel ratio, pinch zoom, the text size against 16px and
   * reduced motion.
   */
  look?: string;
  theme?: string;
  palette?: string;
  pattern?: string;
  readingFont?: string;
  readingSize?: string;
  readingSpacing?: string;
  readingTint?: string;
  pixelRatio?: number;
  zoom?: number;
  textScale?: number;
  reducedMotion?: boolean;
}

export type DisplayDetails = Pick<
  DeviceDetails,
  | 'look'
  | 'theme'
  | 'palette'
  | 'pattern'
  | 'readingFont'
  | 'readingSize'
  | 'readingSpacing'
  | 'readingTint'
  | 'pixelRatio'
  | 'zoom'
  | 'textScale'
  | 'reducedMotion'
>;

const SETTING = /^[a-z0-9-]{1,40}$/;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * F16: the root element's appearance and reading settings (as the app sets them), plus the
 * screen's pixel ratio, pinch zoom and text size. Anything that is not a plain setting name is
 * left out.
 */
export function readDisplayDetails(
  root: HTMLElement,
  env: { pixelRatio: number; zoom: number; rootFontPx: number; reducedMotion: boolean },
): DisplayDetails {
  const d = root.dataset;
  const setting = (value: string | undefined, fallback?: string) => {
    const v = value ?? fallback;
    return v && SETTING.test(v) ? v : undefined;
  };
  const named = {
    look: setting(d.effectStyle),
    theme: setting(d.theme, 'light'),
    palette: setting(d.palette, 'standard'),
    pattern: setting(d.pattern, 'on'),
    readingFont: setting(d.readingFont, 'standard'),
    readingSize: setting(d.readingSize, 'normal'),
    readingSpacing: setting(d.readingSpacing, 'normal'),
    readingTint: setting(d.readingTint, 'none'),
  };
  return {
    ...Object.fromEntries(Object.entries(named).filter(([, v]) => v !== undefined)),
    pixelRatio: round2(env.pixelRatio),
    zoom: round2(env.zoom),
    textScale: round2(env.rootFontPx / 16),
    reducedMotion: env.reducedMotion,
  };
}

/** The display details of this browser right now (F16). */
export function currentDisplayDetails(): DisplayDetails {
  let reducedMotion = false;
  try {
    reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    reducedMotion = false;
  }
  const root = document.documentElement;
  return readDisplayDetails(root, {
    pixelRatio: window.devicePixelRatio || 1,
    zoom: window.visualViewport?.scale ?? 1,
    rootFontPx: parseFloat(getComputedStyle(root).fontSize) || 16,
    reducedMotion,
  });
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
