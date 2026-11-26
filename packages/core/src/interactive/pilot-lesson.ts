import { isWeakSpot } from '../mastery';

/**
 * The interactive lesson pilot (W8; owner, 2026-11-26): area model steps for factorising
 * quadratics (A4), shown only to students for whom the topic is a weak spot.
 */

/** Content tag on the pilot's steps (explore, guided and typed). */
export const INTERACTIVE_PILOT_TAG = 'interactive-pilot';

/**
 * Whether a lesson shows the pilot steps: a lesson on one topic that is a weak spot (mastery
 * below 60). A topic with no history yet is not a weak spot, so it gets the normal lesson.
 */
export function showsInteractivePilot({
  mastery,
  topicCount,
}: {
  /** Topic mastery 0 to 100, or undefined when the student has no answers on it yet. */
  mastery: number | undefined;
  topicCount: number;
}): boolean {
  return topicCount === 1 && mastery !== undefined && isWeakSpot(mastery);
}

/**
 * Puts the pilot steps first (keeping their order), followed by the topic's normal questions as
 * the hand-over; or leaves them out when the pilot does not show.
 */
export function arrangeInteractivePilot<T>(
  rows: readonly T[],
  isPilot: (row: T) => boolean,
  show: boolean,
): T[] {
  const rest = rows.filter((r) => !isPilot(r));
  return show ? [...rows.filter(isPilot), ...rest] : rest;
}
