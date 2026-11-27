/**
 * F17: the starting test's time limit can be extended (WCAG 2.2.1 Timing Adjustable, "extend").
 * In the last minute a pupil can tap "More time" to add two minutes, up to ten times. The rule asks
 * for at least ten extensions, each with a warning and at least 20 seconds to act (the one-minute
 * warning gives 60).
 */
export const MORE_TIME_SECONDS = 120;
export const MORE_TIME_USES = 10;
/** More time is offered from this many seconds left: the same moment as the warning. */
const OFFER_FROM_SECONDS = 60;

export function secondsLeft({
  limitSeconds,
  extraSeconds,
  elapsedMs,
}: {
  limitSeconds: number;
  extraSeconds: number;
  elapsedMs: number;
}): number {
  return Math.max(0, limitSeconds + extraSeconds - Math.floor(elapsedMs / 1000));
}

export function canAddTime({ secondsLeft, used }: { secondsLeft: number; used: number }): boolean {
  return secondsLeft > 0 && secondsLeft <= OFFER_FROM_SECONDS && used < MORE_TIME_USES;
}
