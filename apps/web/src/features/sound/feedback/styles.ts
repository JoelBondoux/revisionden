/**
 * One sound pack per effect style (J's styles), synthesised with Web Audio: no files.
 * Sticker Book: paper peel, slap, stamp, pencil tick. Pop Burst: bubbly pops and jelly boings.
 * Starlight: chimes, shimmer and soft swells. All soft waves, short and volume-balanced.
 */
import { sound, type Note, type SoundFn } from '../bank';
import type { FeedbackEvent } from './events';

export const FEEDBACK_STYLES = ['sticker-book', 'pop-burst', 'starlight'] as const;
export type FeedbackStyle = (typeof FEEDBACK_STYLES)[number];
export const DEFAULT_STYLE: FeedbackStyle = 'sticker-book';

/** A style id from J's style system; styles without a pack yet use the default. */
export function resolveStyle(id: string | null | undefined): FeedbackStyle {
  return (FEEDBACK_STYLES as readonly string[]).includes(id ?? '')
    ? (id as FeedbackStyle)
    : DEFAULT_STYLE;
}

type N = Note;
const tri = (freq: number, at: number, dur: number, peak: number, glideTo?: number): N => ({
  freq,
  at,
  dur,
  peak,
  glideTo,
  wave: 'triangle',
});
const sin = (
  freq: number,
  at: number,
  dur: number,
  peak: number,
  glideTo?: number,
  attack?: number,
): N => ({ freq, at, dur, peak, glideTo, attack, wave: 'sine' });

// ---- Sticker Book: paper and ink ----
/** A soft low thump, like a rubber stamp landing. */
const stamp = (at: number, peak = 0.42) => sin(150, at, 0.12, peak, 55);
/** A fast falling rustle, like a sticker peeling off its sheet. */
const peel = (at: number, dur = 0.12, peak = 0.2) => tri(1900, at, dur, peak, 450);

const stickerBook: Record<FeedbackEvent, SoundFn> = {
  buttonPress: sound(tri(3200, 0, 0.03, 0.18, 2600)),
  cardFlip: sound(peel(0), tri(640, 0.08, 0.05, 0.1)),
  correct: sound(stamp(0), tri(784, 0.05, 0.25, 0.3), tri(1046.5, 0.1, 0.3, 0.25)),
  wrong: sound(sin(330, 0, 0.3, 0.25, 262)),
  combo: sound(sin(185, 0, 0.1, 0.38, 70), tri(880, 0.03, 0.25, 0.3), tri(1318.5, 0.08, 0.25, 0.2)),
  xpTick: sound(tri(2400, 0, 0.025, 0.12)),
  ringFill: sound(tri(1200, 0, 0.05, 0.12, 1500)),
  rewardWobble: sound(tri(900, 0, 0.07, 0.15, 700), tri(700, 0.07, 0.07, 0.15, 900)),
  rewardOpen: sound(peel(0, 0.25), stamp(0.22, 0.4)),
  rewardUnlock: sound(stamp(0), tri(1046.5, 0.06, 0.45, 0.28), tri(1318.5, 0.12, 0.45, 0.22)),
  setComplete: sound(
    stamp(0, 0.36),
    stamp(0.16, 0.4),
    tri(784, 0.3, 0.2, 0.25),
    tri(1046.5, 0.38, 0.2, 0.25),
    tri(1568, 0.46, 0.5, 0.22),
  ),
  levelUp: sound(
    stamp(0, 0.3),
    stamp(0.14, 0.35),
    stamp(0.28, 0.42),
    tri(1046.5, 0.4, 0.7, 0.25),
    tri(1318.5, 0.4, 0.7, 0.2),
    tri(1568, 0.4, 0.7, 0.2),
  ),
  homeEnter: sound(peel(0, 0.18, 0.18), tri(2600, 0.15, 0.03, 0.12), tri(2900, 0.22, 0.03, 0.12)),
  nodePop: sound(tri(1500, 0, 0.04, 0.12, 1800)),
  // A dull little tap on a locked sticker: "not yet", never a buzzer.
  locked: sound(sin(220, 0, 0.12, 0.25, 180), sin(196, 0.1, 0.12, 0.2)),
};

// ---- Pop Burst: bubbles and jelly ----
/** A bubbly pop: a quick upward sine blip. */
const pop = (freq: number, at: number, peak = 0.32) => sin(freq, at, 0.06, peak, freq * 2.1);
/** A jelly boing: a sine that springs down and back up. */
const boing = (freq: number, at: number, peak = 0.3): N[] => [
  sin(freq, at, 0.09, peak, freq * 0.6),
  sin(freq * 0.6, at + 0.09, 0.12, peak * 0.8, freq * 0.85),
];

const popBurst: Record<FeedbackEvent, SoundFn> = {
  buttonPress: sound(sin(520, 0, 0.04, 0.2, 1100)),
  cardFlip: sound(sin(310, 0, 0.08, 0.2, 620), sin(620, 0.08, 0.06, 0.16, 450)),
  correct: sound(pop(620, 0), pop(830, 0.08)),
  wrong: sound(...boing(260, 0, 0.24)),
  combo: sound(pop(700, 0), ...boing(900, 0.06, 0.26)),
  xpTick: sound(sin(900, 0, 0.025, 0.12, 1500)),
  ringFill: sound(sin(700, 0, 0.05, 0.12, 1000)),
  rewardWobble: sound(
    sin(400, 0, 0.06, 0.18, 520),
    sin(520, 0.06, 0.06, 0.18, 380),
    sin(380, 0.12, 0.06, 0.15, 460),
  ),
  rewardOpen: sound(sin(300, 0, 0.12, 0.4, 900), pop(1200, 0.12, 0.18), pop(1500, 0.18, 0.15)),
  rewardUnlock: sound(
    pop(520, 0),
    pop(660, 0.07),
    pop(780, 0.14),
    pop(1040, 0.21),
    ...boing(700, 0.3),
  ),
  setComplete: sound(
    pop(520, 0),
    pop(660, 0.08),
    pop(780, 0.16),
    pop(1040, 0.24, 0.35),
    ...boing(520, 0.36, 0.28),
  ),
  levelUp: sound(
    pop(440, 0),
    pop(550, 0.08),
    pop(660, 0.16),
    pop(880, 0.24),
    pop(1100, 0.32, 0.35),
    ...boing(660, 0.44, 0.32),
    sin(880, 0.7, 0.5, 0.2),
  ),
  homeEnter: sound(pop(520, 0, 0.2), pop(660, 0.06, 0.2), pop(780, 0.12, 0.22)),
  nodePop: sound(sin(600, 0, 0.05, 0.14, 1300)),
  locked: sound(...boing(240, 0, 0.24)),
};

// ---- Starlight: chimes, shimmer and swells ----
/** A clear chime with a faint triangle sparkle. */
const chime = (freq: number, at: number, dur = 0.3, peak = 0.3): N[] => [
  sin(freq, at, dur, peak),
  tri(freq * 2, at, dur * 0.5, peak * 0.15),
];
/** A soft swell: fades in slowly, then away. */
const swell = (freq: number, at: number, dur = 0.6, peak = 0.3) =>
  sin(freq, at, dur, peak, undefined, dur * 0.45);
/** A quiet shimmer of high notes. */
const shimmer = (at: number, base = 2093, peak = 0.1): N[] => [
  sin(base, at, 0.12, peak),
  sin(base * 1.26, at + 0.05, 0.12, peak),
  sin(base * 1.5, at + 0.1, 0.15, peak),
];

const starlight: Record<FeedbackEvent, SoundFn> = {
  buttonPress: sound(sin(2093, 0, 0.05, 0.12)),
  cardFlip: sound(sin(1568, 0, 0.06, 0.14), sin(2093, 0.05, 0.08, 0.12)),
  correct: sound(...chime(1046.5, 0), ...chime(1568, 0.09, 0.35)),
  wrong: sound(sin(392, 0, 0.4, 0.2, 330, 0.12)),
  combo: sound(...chime(1318.5, 0, 0.25), ...chime(1760, 0.07, 0.3, 0.26)),
  xpTick: sound(sin(2637, 0, 0.03, 0.1)),
  ringFill: sound(sin(1760, 0, 0.05, 0.1, 1975)),
  rewardWobble: sound(...shimmer(0, 2349, 0.12)),
  rewardOpen: sound(swell(523.25, 0, 0.6, 0.34), ...shimmer(0.35)),
  rewardUnlock: sound(
    swell(523.25, 0, 0.8, 0.26),
    swell(659.25, 0, 0.8, 0.22),
    ...chime(1568, 0.3, 0.4),
    ...shimmer(0.5),
  ),
  setComplete: sound(
    ...chime(1046.5, 0, 0.25, 0.26),
    ...chime(1318.5, 0.1, 0.25, 0.26),
    ...chime(1568, 0.2, 0.3, 0.26),
    swell(523.25, 0.1, 0.9, 0.24),
  ),
  levelUp: sound(
    swell(392, 0, 1.1, 0.24),
    swell(523.25, 0.1, 1.1, 0.22),
    swell(659.25, 0.2, 1.1, 0.2),
    ...chime(1568, 0.5, 0.4),
    ...shimmer(0.8, 2349),
  ),
  homeEnter: sound(swell(523.25, 0, 0.5, 0.2), ...shimmer(0.1, 1568, 0.12)),
  nodePop: sound(sin(2349, 0, 0.05, 0.1)),
  locked: sound(sin(330, 0, 0.25, 0.2, 294, 0.06)),
};

export const stylePacks: Record<FeedbackStyle, Record<FeedbackEvent, SoundFn>> = {
  'sticker-book': stickerBook,
  'pop-burst': popBurst,
  starlight,
};
