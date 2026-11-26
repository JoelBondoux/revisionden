/**
 * Feedback: one call per animation plays the active style's sound and its vibration, within
 * the rules (mute, the Vibration switch, tap sounds, Test mode, reduced motion, first tap),
 * throttled so fast ticks never stack into noise or buzzing.
 */
import { comboPitch, type SoundEngine } from '../engine';
import type { SoundMode } from '../events';
import type { SoundSettings } from '../settings';
import { feedbackAllowed, type FeedbackEvent } from './events';
import { hapticPattern, type HapticsDriver } from './haptics';
import { DEFAULT_STYLE, resolveStyle, stylePacks, type FeedbackStyle } from './styles';

export interface EmitOptions {
  /** Combo step (1 to 6) for `combo`. */
  step?: number;
  mode?: SoundMode;
  delay?: number;
}

export interface EmitResult {
  sound: boolean;
  haptic: boolean;
}

export interface Feedback {
  emit(event: FeedbackEvent, options?: EmitOptions): EmitResult;
  /** Vibration only, for sounds played elsewhere (reward tiers). */
  vibrateFor(event: FeedbackEvent, step?: number): boolean;
  setStyle(id: string | null | undefined): void;
  style(): FeedbackStyle;
  readonly vibrationSupported: boolean;
}

/** Minimum gap between sounds of the same event, for events that fire in fast runs. */
const SOUND_GAP_MS: Partial<Record<FeedbackEvent, number>> = {
  xpTick: 70,
  nodePop: 70,
  ringFill: 90,
  buttonPress: 40,
  particleBurst: 60,
  prizeBox: 50,
  pageTransition: 150,
};
/** Events whose pitch climbs with `step`, a whole tone each. */
const STEPPED: ReadonlySet<FeedbackEvent> = new Set(['combo', 'prizeBox']);
/** Pop-like events that vary their pitch slightly each time, so repeats never sound robotic. */
const WOBBLE: ReadonlySet<FeedbackEvent> = new Set([
  'correct',
  'particleBurst',
  'nodeComplete',
  'nodePop',
]);
/** Up to 3 percent either way. */
const WOBBLE_AMOUNT = 0.06;
const MAX_SOUNDS_PER_SECOND = 10;
const BUZZ_GAP_MS = 100;
const MAX_BUZZES_PER_SECOND = 4;
/** Reduced motion: sounds at half loudness and buzzes shorter. */
const REDUCED_GAIN = 0.5;
const REDUCED_BUZZ = 0.6;

export interface FeedbackDeps {
  engine: SoundEngine;
  settings: () => SoundSettings;
  haptics: HapticsDriver;
  now: () => number;
  reducedMotion: () => boolean;
  /** Returns [0, 1); used for the small pitch wobble on pops. Defaults to Math.random. */
  random?: () => number;
}

/** Keeps times inside a rolling one-second window. */
function window1s() {
  const times: number[] = [];
  return {
    count(now: number) {
      while (times.length && now - times[0]! >= 1000) times.shift();
      return times.length;
    },
    add: (now: number) => void times.push(now),
  };
}

export function createFeedback(deps: FeedbackDeps): Feedback {
  let style: FeedbackStyle = DEFAULT_STYLE;
  const lastSound = new Map<FeedbackEvent, number>();
  const sounds = window1s();
  const buzzes = window1s();
  let lastBuzz = -Infinity;
  const random = deps.random ?? Math.random;

  function playSound(event: FeedbackEvent, options: EmitOptions): boolean {
    const settings = deps.settings();
    if (event === 'buttonPress' && !settings.taps) return false;
    const now = deps.now();
    const gap = SOUND_GAP_MS[event];
    const last = lastSound.get(event);
    if (gap !== undefined && last !== undefined && now - last < gap) return false;
    if (sounds.count(now) >= MAX_SOUNDS_PER_SECOND) return false;
    const played = deps.engine.playSound(stylePacks[style][event], {
      pitch: STEPPED.has(event)
        ? comboPitch(options.step)
        : WOBBLE.has(event)
          ? 1 + (random() - 0.5) * WOBBLE_AMOUNT
          : 1,
      gain: deps.reducedMotion() ? REDUCED_GAIN : 1,
      delay: options.delay,
    });
    if (played) {
      lastSound.set(event, now);
      sounds.add(now);
    }
    return played;
  }

  function vibrate(event: FeedbackEvent, step?: number): boolean {
    if (!deps.haptics.supported || !deps.settings().vibration || !deps.engine.isUnlocked()) {
      return false;
    }
    const pattern = hapticPattern(style, event, step);
    if (!pattern) return false;
    const now = deps.now();
    if (now - lastBuzz < BUZZ_GAP_MS || buzzes.count(now) >= MAX_BUZZES_PER_SECOND) return false;
    const scaled = deps.reducedMotion()
      ? pattern.map((ms, i) => (i % 2 === 0 ? Math.max(1, Math.round(ms * REDUCED_BUZZ)) : ms))
      : pattern;
    deps.haptics.vibrate(scaled);
    lastBuzz = now;
    buzzes.add(now);
    return true;
  }

  return {
    emit(event, options = {}) {
      if (!feedbackAllowed(event, options.mode)) return { sound: false, haptic: false };
      return { sound: playSound(event, options), haptic: vibrate(event, options.step) };
    },
    vibrateFor: (event, step) => vibrate(event, step),
    setStyle(id) {
      style = resolveStyle(id);
    },
    style: () => style,
    get vibrationSupported() {
      return deps.haptics.supported;
    },
  };
}
