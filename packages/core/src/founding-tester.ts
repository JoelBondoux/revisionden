/**
 * Founding Tester (R5, owner decision 2026-11-26; see docs/REWARDS.md "Founding Tester").
 *
 * A one-off badge and title for students who used RevisionDen before 1.0. It is granted only
 * once the 1.0 cut-off (`BETA_ENDS_AT`) is set and has passed, and only to students with real
 * activity strictly before it: a lesson or quiz answer, or a completed flashcard session.
 * Activity at or after the cut-off belongs to 1.0 and never counts, so it can never be earned
 * after release. Pure and deterministic: the API passes the times of existing activity rows.
 */
export const FOUNDING_TESTER_ID = 'founding-tester';

export function foundingTesterStat(input: {
  /** The 1.0 cut-off; unset until release, so nobody gets it early. */
  betaEndsAt: Date | undefined;
  now: Date;
  /** Times of the student's answers and completed flashcard sessions. */
  activityAt: readonly Date[];
}): 0 | 1 {
  const { betaEndsAt, now, activityAt } = input;
  if (!betaEndsAt || now.getTime() < betaEndsAt.getTime()) return 0;
  return activityAt.some((at) => at.getTime() < betaEndsAt.getTime()) ? 1 : 0;
}
