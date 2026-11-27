/**
 * Bug button rest (L13, docs/PRODUCT_RULES.md "Bug icon"). When the operator marks a student's
 * bug reports "Not a bug" too often, the bug button takes a rest; if it keeps happening, it is
 * removed until a parent or the operator switches it back on. Only reports sent as a bug and
 * marked Not a bug count. All the numbers are here.
 */
export const NOT_A_BUG_LIMIT = 3;
export const NOT_A_BUG_WINDOW_DAYS = 14;
export const BUG_BUTTON_PAUSE_DAYS = 7;
export const BUG_BUTTON_PAUSES_BEFORE_REMOVAL = 3;
export const BUG_BUTTON_REMOVAL_WINDOW_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export type BugButtonState =
  { state: 'on' } | { state: 'paused'; until: Date } | { state: 'removed' };

export interface BugButtonInput {
  /** When each of the student's bug reports was marked Not a bug. */
  notABugAt: readonly Date[];
  /** When a parent or the operator last switched the button back on; earlier outcomes don't count. */
  resetAt?: Date | null;
  /** A tester account (operator console): Not-a-bug outcomes never rest its button. */
  tester?: boolean;
  now: Date;
}

/**
 * NOT_A_BUG_LIMIT outcomes within NOT_A_BUG_WINDOW_DAYS (the last at most that long after the
 * first) pause the button for BUG_BUTTON_PAUSE_DAYS from the last of them. Outcomes behind a
 * pause don't count again. The BUG_BUTTON_PAUSES_BEFORE_REMOVAL-th pause within
 * BUG_BUTTON_REMOVAL_WINDOW_DAYS of the first of them removes the button.
 */
export function bugButtonState({
  notABugAt,
  resetAt,
  tester = false,
  now,
}: BugButtonInput): BugButtonState {
  if (tester) return { state: 'on' };
  const after = resetAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  const times = notABugAt
    .map((d) => d.getTime())
    .filter((t) => t > after && t <= now.getTime())
    .sort((a, b) => a - b);

  const pauses: number[] = [];
  let recent: number[] = [];
  for (const t of times) {
    recent = [...recent.filter((r) => t - r <= NOT_A_BUG_WINDOW_DAYS * DAY_MS), t];
    if (recent.length < NOT_A_BUG_LIMIT) continue;
    pauses.push(t);
    recent = [];
    const first = pauses[pauses.length - BUG_BUTTON_PAUSES_BEFORE_REMOVAL];
    if (first !== undefined && t - first <= BUG_BUTTON_REMOVAL_WINDOW_DAYS * DAY_MS) {
      return { state: 'removed' };
    }
  }

  const last = pauses[pauses.length - 1];
  if (last !== undefined) {
    const until = last + BUG_BUTTON_PAUSE_DAYS * DAY_MS;
    if (now.getTime() < until) return { state: 'paused', until: new Date(until) };
  }
  return { state: 'on' };
}
