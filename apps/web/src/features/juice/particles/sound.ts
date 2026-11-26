import { FEEDBACK_EVENTS, type FeedbackEvent } from '../../sound/feedback/events';

/**
 * U8 adds `prizeBox` (steps 1 to 3) and `particleBurst` to the feedback events. Until that lands,
 * these fall back to an event that exists, so the order the two changes land in does not matter.
 */
export function eventOr<F extends FeedbackEvent | null>(
  events: readonly string[],
  wanted: string,
  fallback: F,
): FeedbackEvent | F {
  return events.includes(wanted) ? (wanted as FeedbackEvent) : fallback;
}

export const PRIZE_STEP_EVENT = eventOr(FEEDBACK_EVENTS, 'prizeBox', 'nodePop');
/**
 * No stand-in for the burst sound: every burst already comes with its moment's own sound (the
 * chime, the goal sound), so a stand-in would only double it.
 */
export const BURST_EVENT = eventOr(FEEDBACK_EVENTS, 'particleBurst', null);

/** The burst sound plays at most once every 140 ms (the mockup's throttle). */
export const BURST_SOUND_GAP_MS = 140;

export function burstSoundDue(now: number, last: number | null): boolean {
  return last === null || now - last > BURST_SOUND_GAP_MS;
}
