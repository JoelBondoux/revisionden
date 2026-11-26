/**
 * Student passkey unlock (workstream I5). A student device session lasts 12 hours; after that the
 * student unlocks again with the passkey on the device, at `/unlock`.
 */

/**
 * True for an API path that needs the student device session (`/v1/student/...`), whether the
 * API is on its own host or under `/api` on this site.
 */
export function isStudentApiPath(path: string | undefined): boolean {
  return /^(\/api)?\/v1\/student(\/|$)/.test(path ?? '');
}

/** Where the student goes after unlocking when there is nowhere better: Home (J15b). */
export const DEFAULT_STUDENT_PAGE = '/home';

/** The unlock page, remembering where the student was. */
export function unlockPath(returnTo?: string): string {
  return returnTo ? `/unlock?returnTo=${encodeURIComponent(returnTo)}` : '/unlock';
}

/** A page in this app to go to after unlocking (never another site, never the unlock page). */
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return DEFAULT_STUDENT_PAGE;
  }
  if (raw === '/unlock' || raw.startsWith('/unlock?') || raw === '/') return DEFAULT_STUDENT_PAGE;
  return raw;
}
