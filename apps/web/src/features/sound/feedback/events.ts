import { allowedInMode, type SoundEvent, type SoundMode } from '../events';

/**
 * Every animation fires one of these (agreed with J, game feel). Each has a sound in every
 * style pack and, where it suits, a vibration pattern.
 */
export const FEEDBACK_EVENTS = [
  'buttonPress',
  'cardFlip',
  'correct',
  'wrong',
  'combo',
  'xpTick',
  'ringFill',
  'rewardWobble',
  'rewardOpen',
  'rewardUnlock',
  'setComplete',
  'levelUp',
  // Added with J for Home and the topic map.
  'homeEnter',
  'nodePop',
  'locked',
  // U7: the one-off reveal when the starting test unlocks three new styles at once.
  'stylesUnlocked',
] as const;

export type FeedbackEvent = (typeof FEEDBACK_EVENTS)[number];

/** Which existing sound rule each event follows (Test mode: marking and rewards wait for submit). */
const RULE: Record<FeedbackEvent, SoundEvent> = {
  buttonPress: 'tap',
  cardFlip: 'cardFlip',
  correct: 'correct',
  wrong: 'wrong',
  combo: 'correct',
  xpTick: 'cardFlip',
  ringFill: 'cardFlip',
  rewardWobble: 'cardFlip',
  rewardOpen: 'cardFlip',
  rewardUnlock: 'rewardUnlocked',
  setComplete: 'celebration',
  levelUp: 'levelUp',
  homeEnter: 'cardFlip',
  nodePop: 'cardFlip',
  locked: 'cardFlip',
  stylesUnlocked: 'rewardUnlocked',
};

export function feedbackAllowed(event: FeedbackEvent, mode?: SoundMode): boolean {
  return allowedInMode(RULE[event], mode);
}

/**
 * The older sound events that now follow the active style (so existing `play()` calls switch
 * with the style). Anything not listed keeps its sound from the main bank.
 */
export const STYLED_SOUNDS: Partial<Record<SoundEvent, FeedbackEvent>> = {
  tap: 'buttonPress',
  correct: 'correct',
  wrong: 'wrong',
  cardFlip: 'cardFlip',
  celebration: 'setComplete',
  levelUp: 'levelUp',
  rewardUnlocked: 'rewardUnlock',
};
