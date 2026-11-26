/**
 * Haptics: vibration patterns for each style and event.
 *
 * A `HapticsDriver` is the plug-in point. On the web it is `navigator.vibrate` (Android Chrome
 * and most Android browsers). iPhone and iPad browsers, and Home Screen apps on them, have no
 * Vibration API, so there it does nothing. A native wrapper (for example a Capacitor or
 * React Native shell) could later pass a driver that calls the platform's real haptics.
 */
import type { FeedbackEvent } from './events';
import type { FeedbackStyle } from './styles';

export interface HapticsDriver {
  /** False where the device cannot vibrate: feedback then quietly skips vibration. */
  readonly supported: boolean;
  /** Alternating buzz and pause lengths in milliseconds. Never throws. */
  vibrate(pattern: number[]): void;
}

/** The web driver over `navigator.vibrate`, feature-detected. */
export function createWebHaptics(
  nav: { vibrate?: (pattern: number[]) => boolean } | undefined,
): HapticsDriver {
  const vibrate = nav?.vibrate;
  const supported = typeof vibrate === 'function';
  return {
    supported,
    vibrate(pattern) {
      if (!supported) return;
      try {
        vibrate.call(nav, pattern);
      } catch {
        // Blocked (no user gesture yet, or a policy): skip it.
      }
    },
  };
}

/** Buzz lengths (ms) for each event; pauses between them come from the style. */
const BUZZES: Record<Exclude<FeedbackEvent, 'combo'>, number[] | null> = {
  buttonPress: [10],
  cardFlip: [12],
  correct: [18, 18],
  wrong: [30],
  xpTick: null,
  ringFill: null,
  rewardWobble: [8, 8],
  rewardOpen: [15, 25],
  rewardUnlock: [30, 30, 70],
  setComplete: [20, 20, 50],
  levelUp: [30, 40, 60, 90],
};

/** How each style feels: Sticker Book crisp, Pop Burst bouncy and quick, Starlight soft and long. */
const FEEL: Record<FeedbackStyle, { scale: number; gap: number }> = {
  'sticker-book': { scale: 1, gap: 40 },
  'pop-burst': { scale: 0.8, gap: 25 },
  starlight: { scale: 1.3, gap: 55 },
};

const MAX_COMBO = 6;

/** A combo's rising rhythm: more and longer pulses as the combo grows (capped at 6). */
function comboBuzzes(step: number): number[] {
  const n = Math.max(1, Math.min(MAX_COMBO, Math.floor(step)));
  const count = Math.min(2 + Math.floor(n / 2), 5);
  return Array.from({ length: count }, (_, i) => 10 + i * 6 + n * 3);
}

function weave(buzzes: number[], style: FeedbackStyle): number[] {
  const { scale, gap } = FEEL[style];
  const out: number[] = [];
  buzzes.forEach((b, i) => {
    if (i > 0) out.push(gap);
    out.push(Math.round(b * scale));
  });
  return out;
}

/** The vibration pattern for an event in a style, or null when it should not vibrate. */
export function hapticPattern(
  style: FeedbackStyle,
  event: FeedbackEvent,
  step = 1,
): number[] | null {
  const buzzes = event === 'combo' ? comboBuzzes(step) : BUZZES[event];
  if (!buzzes) return null;
  const pattern = weave(buzzes, style);
  // Presses and flips stay a light tick whatever the style.
  if (event === 'buttonPress' || event === 'cardFlip') pattern[0] = Math.min(pattern[0]!, 15);
  return pattern;
}
