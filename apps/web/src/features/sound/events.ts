/** Every moment in the app that can make a sound. One synthesised sound each (see `bank.ts`). */
export const SOUND_EVENTS = [
  'tap',
  'correct',
  'wrong',
  'partMarks',
  'submit',
  'reveal',
  'streakDay',
  'levelUp',
  'rewardUnlocked',
  'giftSent',
  'giftReceived',
  'cardFlip',
  'cardRated',
  'sessionDropped',
  'celebration',
  'timerWarning',
] as const;

export type SoundEvent = (typeof SOUND_EVENTS)[number];

/** Learn mode marks live; Test mode marks after submit; timed papers stay quiet but for the timer. */
export type SoundMode = 'learn' | 'test' | 'timed';

/** Never in Test mode before submit: marking sounds, and reward sounds (they follow marking). */
const MARKING_SOUNDS: ReadonlySet<SoundEvent> = new Set([
  'correct',
  'wrong',
  'partMarks',
  'rewardUnlocked',
  'levelUp',
]);

/**
 * The Test mode rule: no correct, wrong or part-marks sound before the student submits (the
 * reveal plays once for the whole set instead). Timed papers play only the timer warning.
 */
export function allowedInMode(event: SoundEvent, mode: SoundMode = 'learn'): boolean {
  if (mode === 'timed') return event === 'timerWarning';
  if (mode === 'test') return !MARKING_SOUNDS.has(event);
  return true;
}

/** The sound for a marked answer: full marks, some marks or none. */
export function markSound(result: { correct: boolean; score: number }): SoundEvent {
  if (result.correct) return 'correct';
  return result.score > 0 ? 'partMarks' : 'wrong';
}
