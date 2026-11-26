/**
 * Closing the "We've updated" notice without reading it hides it on this device for 24 hours,
 * for those exact policy versions only (docs/LEGAL.md). Reading it ("I've read the changes")
 * records the versions on the server instead, so it never comes back for them.
 */
export const POLICY_NOTICE_KEY = 'revisionden.policyNotice';
export const POLICY_NOTICE_SNOOZE_MS = 24 * 60 * 60 * 1000;

export type SnoozeStorage = Pick<Storage, 'getItem' | 'setItem'>;
type Versions = Record<string, string>;

interface Snooze {
  versions: Versions;
  until: number;
}

function read(storage: SnoozeStorage | undefined): Snooze | null {
  try {
    const raw = storage?.getItem(POLICY_NOTICE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Snooze>;
    if (typeof parsed.until !== 'number' || typeof parsed.versions !== 'object') return null;
    return { until: parsed.until, versions: parsed.versions ?? {} };
  } catch {
    return null;
  }
}

/** True while the notice for exactly these versions was closed less than 24 hours ago. */
export function isSnoozed(storage: SnoozeStorage | undefined, versions: Versions, now: number) {
  const snooze = read(storage);
  if (!snooze || now >= snooze.until) return false;
  const names = Object.keys(versions);
  return names.length > 0 && names.every((name) => snooze.versions[name] === versions[name]);
}

export function snooze(storage: SnoozeStorage | undefined, versions: Versions, now: number) {
  try {
    storage?.setItem(
      POLICY_NOTICE_KEY,
      JSON.stringify({ versions, until: now + POLICY_NOTICE_SNOOZE_MS }),
    );
  } catch {
    // Storage blocked (private mode): the notice simply shows again next time.
  }
}

/** The browser's local storage, or nothing where it is unavailable. */
export function deviceStorage(): SnoozeStorage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
