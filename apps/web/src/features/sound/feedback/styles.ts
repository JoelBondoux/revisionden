/**
 * One sound pack per effect style (J's styles), synthesised with Web Audio: no files.
 * Sticker Book: paper peel, slap, stamp, pencil tick. Pop Burst: bubbly pops and jelly boings.
 * Starlight: chimes, shimmer and soft swells. Comic Pop: punchy squares and whooshes.
 * Garden Grow: soft woodwind and chimes. Pixel Arcade: chiptune. Doodle Diary: pencil scratches,
 * page flips, biro clicks, a rubber squeak and a scribble flourish. Matched to J's mockup previews.
 * Petal Glow: music-box bells and petal swishes. Turbo Drive: low thumps, clicks, whooshes and
 * power-fifth stabs. Rainbow Parade: bright major-scale runs. Plus one shared reveal for the
 * moment all three unlock.
 * Short and volume-balanced; square waves only in Comic Pop and Pixel Arcade, always low-passed,
 * and "wrong" stays soft (sine or triangle) in every style.
 */
import { sound, type Noise, type Note, type SoundFn } from '../bank';
import type { FeedbackEvent } from './events';

export { SQUARE_LOWPASS_HZ } from '../bank';

/** U8's new moments: built from each style's pops, whizzes and sparkles, not hand-written. */
type JuiceEvent = 'goalHit' | 'nodeComplete' | 'pageTransition' | 'particleBurst' | 'prizeBox';
type BaseEvent = Exclude<FeedbackEvent, JuiceEvent>;

export const FEEDBACK_STYLES = [
  'sticker-book',
  'pop-burst',
  'starlight',
  'comic-pop',
  'garden-grow',
  'pixel-arcade',
  'doodle-diary',
  // U7: unlocked together by finishing the starting test. Ids are placeholders until J confirms.
  'petal-glow',
  'turbo-drive',
  'rainbow-parade',
] as const;
export type FeedbackStyle = (typeof FEEDBACK_STYLES)[number];
/**
 * The style used until a child picks one: Doodle Diary (owner-approved, matching J's default
 * look). The other six, Sticker Book included, are unlockable styles. One value to change.
 */
export const DEFAULT_STYLE: FeedbackStyle = 'doodle-diary';

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
/** A square wave (Comic Pop and Pixel Arcade only); the bank low-passes it. */
const sq = (freq: number, at: number, dur: number, peak: number, glideTo?: number): N => ({
  freq,
  at,
  dur,
  peak,
  glideTo,
  wave: 'square',
});
/** Filtered noise: paper, pencil, whoosh. */
const nz = (
  filter: Noise['noise'],
  freq: number,
  at: number,
  dur: number,
  peak: number,
  more: Pick<Noise, 'glideTo' | 'q' | 'attack'> = {},
): Noise => ({ noise: filter, freq, at, dur, peak, ...more });
/** A note by MIDI number (69 = A4, 440 Hz), as in J's previews. */
const m = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
/** An arpeggio: one note per MIDI number, `gap` seconds apart. */
const arp = <T>(midis: number[], make: (freq: number, at: number) => T, gap: number, start = 0) =>
  midis.map((n, i) => make(m(n), start + i * gap));

/** `sound`, with every part's peak scaled: balances a pack against the others. */
const louder =
  (k: number) =>
  (...parts: (N | Noise)[]): SoundFn =>
    sound(...parts.map((p) => ({ ...p, peak: (p.peak ?? 0.3) * k })));

// ---- U7: the "three styles unlocked" reveal, the same in every style ----
/** A music-box bell: a sine with a soft swell and a faint triangle overtone. */
const bell = (freq: number, at: number, dur: number, peak: number): (N | Noise)[] => [
  sin(freq, at, dur, peak, undefined, 0.015),
  tri(freq * 2, at, dur * 0.5, peak * 0.1),
];
/** A petal swish: soft, high, airy noise. */
const swish = (at: number, peak = 0.08) =>
  nz('bandpass', 4500, at, 0.14, peak, { q: 1.5, glideTo: 6500 });
/** A low punchy thump, like a kick drum. */
const thump = (at: number, peak = 0.4) => sin(150, at, 0.14, peak, 50);
/** A crisp mechanical click. */
const click = (at: number, peak = 0.25) => nz('highpass', 6000, at, 0.015, peak);
/** A rising whoosh. */
const whoosh = (at: number, dur = 0.3, peak = 0.2) =>
  nz('bandpass', 500, at, dur, peak, { glideTo: 4000, q: 0.8 });
/** A bold power-fifth stab (triangle, never square). */
const stab = (freq: number, at: number): N[] => [
  tri(freq, at, 0.12, 0.2),
  tri(freq * 1.5, at, 0.12, 0.14),
];
/** C major, one colour-note per step: C D E F G A B (C). */
const RAINBOW = [72, 74, 76, 77, 79, 81, 83, 84];

const stylesUnlockedReveal: SoundFn = sound(
  // Petal Glow's twinkle...
  ...arp([88, 91, 95], (f, at) => bell(f, at, 0.3, 0.14), 0.08).flat(),
  swish(0.05, 0.06),
  // ...Turbo Drive's thump and whoosh...
  thump(0.5, 0.36),
  whoosh(0.5, 0.35, 0.18),
  ...stab(m(55), 0.62),
  // ...Rainbow Parade's run...
  ...arp(RAINBOW.slice(0, 7), (f, at) => tri(f, at, 0.18, 0.16), 0.06, 1),
  // ...and all three together in one held chord.
  tri(m(84), 1.5, 0.9, 0.2),
  sin(m(88), 1.5, 0.9, 0.16),
  sin(m(91), 1.5, 0.9, 0.16),
);

// ---- Sticker Book: paper and ink ----
/** A soft low thump, like a rubber stamp landing. */
const stamp = (at: number, peak = 0.42) => sin(150, at, 0.12, peak, 55);
/** A fast falling rustle, like a sticker peeling off its sheet. */
const peel = (at: number, dur = 0.12, peak = 0.2) => tri(1900, at, dur, peak, 450);

const stickerBook: Record<BaseEvent, SoundFn> = {
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
  stylesUnlocked: stylesUnlockedReveal,
};

// ---- Pop Burst: bubbles and jelly ----
/** A bubbly pop: a quick upward sine blip. */
const pop = (freq: number, at: number, peak = 0.32) => sin(freq, at, 0.06, peak, freq * 2.1);
/** A jelly boing: a sine that springs down and back up. */
const boing = (freq: number, at: number, peak = 0.3): N[] => [
  sin(freq, at, 0.09, peak, freq * 0.6),
  sin(freq * 0.6, at + 0.09, 0.12, peak * 0.8, freq * 0.85),
];

const popBurst: Record<BaseEvent, SoundFn> = {
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
  stylesUnlocked: stylesUnlockedReveal,
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

const starlight: Record<BaseEvent, SoundFn> = {
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
  stylesUnlocked: stylesUnlockedReveal,
};

// ---- Comic Pop: punchy squares, whooshes and POWs ----
const comicPop: Record<BaseEvent, SoundFn> = {
  buttonPress: sound(sq(300, 0, 0.05, 0.12, 600)),
  cardFlip: sound(nz('bandpass', 800, 0, 0.1, 0.22, { glideTo: 3000 }), sq(400, 0.03, 0.04, 0.08)),
  correct: sound(sq(m(72), 0, 0.09, 0.15), sq(m(79), 0.09, 0.2, 0.15)),
  // A soft deflating "bonk": no squares for wrong.
  wrong: sound(sin(330, 0, 0.25, 0.24, 196)),
  combo: sound(sq(m(63), 0, 0.12, 0.13, m(75)), nz('bandpass', 1500, 0, 0.08, 0.25)),
  xpTick: sound(sq(1500, 0, 0.02, 0.07)),
  ringFill: sound(sq(200, 0, 0.2, 0.1, 800)),
  rewardWobble: sound(
    sq(m(64), 0, 0.06, 0.1),
    sq(m(60), 0.07, 0.06, 0.1),
    sq(m(64), 0.14, 0.06, 0.1),
  ),
  rewardOpen: sound(nz('lowpass', 3000, 0, 0.35, 0.4, { glideTo: 200 }), sq(120, 0, 0.2, 0.18, 60)),
  rewardUnlock: sound(...arp([60, 64, 67, 72], (f, at) => sq(f, at, 0.12, 0.15), 0.08)),
  setComplete: sound(
    ...arp([67, 72, 76], (f, at) => sq(f, at, 0.1, 0.13), 0.1),
    sq(m(79), 0.3, 0.4, 0.15),
  ),
  levelUp: sound(
    nz('lowpass', 2000, 0, 0.3, 0.38, { glideTo: 300 }),
    ...arp([60, 67, 72, 79, 84], (f, at) => sq(f, at, 0.12, 0.13), 0.08, 0.15),
  ),
  homeEnter: sound(nz('bandpass', 400, 0, 0.25, 0.25, { glideTo: 3000 })),
  nodePop: sound(sq(m(64), 0, 0.05, 0.12)),
  locked: sound(sq(150, 0, 0.06, 0.12), sq(110, 0.07, 0.1, 0.12)),
  stylesUnlocked: stylesUnlockedReveal,
};

// ---- Garden Grow: soft woodwind and chimes ----
/** A breathy woodwind note: swells in, with a faint airy overtone. */
const wood = (freq: number, at: number, dur: number, peak: number, glideTo?: number): N[] => [
  sin(freq, at, dur, peak, glideTo, Math.min(0.04, dur / 3)),
  tri(freq * 2, at, dur * 0.6, peak * 0.12, glideTo && glideTo * 2),
];

const gsound = louder(1.5);
const gardenGrow: Record<BaseEvent, SoundFn> = {
  buttonPress: gsound(tri(m(79), 0, 0.12, 0.17)),
  cardFlip: gsound(
    nz('bandpass', 1500, 0, 0.1, 0.12, { glideTo: 3500 }),
    tri(m(84), 0.05, 0.08, 0.1),
  ),
  correct: gsound(...arp([76, 79, 84], (f, at) => wood(f, at, 0.35, 0.17), 0.09).flat()),
  wrong: gsound(sin(m(67), 0, 0.3, 0.18, m(62), 0.04)),
  combo: gsound(tri(m(73), 0, 0.3, 0.15), tri(m(80), 0.07, 0.3, 0.15)),
  xpTick: gsound(tri(m(96), 0, 0.04, 0.07)),
  ringFill: gsound(...wood(m(67), 0, 0.22, 0.12, m(79))),
  // A little bird trill.
  rewardWobble: gsound(
    sin(m(84), 0, 0.06, 0.12),
    sin(m(86), 0.06, 0.06, 0.12),
    sin(m(84), 0.12, 0.08, 0.12),
  ),
  rewardOpen: gsound(
    sin(m(55), 0, 0.8, 0.18, m(79), 0.3),
    nz('highpass', 5000, 0.2, 0.5, 0.06, { attack: 0.2 }),
  ),
  rewardUnlock: gsound(...arp([72, 76, 79, 83, 84], (f, at) => tri(f, at, 0.5, 0.15), 0.1)),
  setComplete: gsound(...arp([72, 76, 79, 84], (f, at) => wood(f, at, 0.7, 0.14), 0.15).flat()),
  levelUp: gsound(...arp([60, 64, 67, 72, 76, 79], (f, at) => tri(f, at, 0.6, 0.15), 0.12)),
  homeEnter: gsound(...arp([67, 71, 74, 79], (f, at) => wood(f, at, 0.4, 0.11), 0.1).flat()),
  nodePop: gsound(tri(m(76), 0, 0.18, 0.12)),
  locked: gsound(tri(m(55), 0, 0.15, 0.12)),
  stylesUnlocked: stylesUnlockedReveal,
};

// ---- Pixel Arcade: chiptune ----
const pixelArcade: Record<BaseEvent, SoundFn> = {
  buttonPress: sound(sq(m(84), 0, 0.04, 0.11)),
  cardFlip: sound(sq(m(72), 0, 0.03, 0.1), sq(m(79), 0.03, 0.03, 0.1)),
  correct: sound(sq(m(83), 0, 0.06, 0.13), sq(m(88), 0.06, 0.16, 0.13)),
  // The soft triangle channel for wrong: no squares.
  wrong: sound(tri(m(60), 0, 0.12, 0.2), tri(m(55), 0.1, 0.2, 0.18)),
  combo: sound(...arp([74, 78, 81], (f, at) => sq(f, at, 0.05, 0.11), 0.04)),
  xpTick: sound(sq(m(96), 0, 0.02, 0.06)),
  ringFill: sound(sq(m(60), 0, 0.2, 0.09, m(84))),
  rewardWobble: sound(
    sq(m(76), 0, 0.04, 0.1),
    sq(m(72), 0.05, 0.04, 0.1),
    sq(m(76), 0.1, 0.04, 0.1),
  ),
  rewardOpen: sound(
    nz('highpass', 2000, 0, 0.08, 0.22),
    ...arp([60, 64, 67, 72, 76, 79, 84], (f, at) => sq(f, at, 0.04, 0.11), 0.03, 0.05),
  ),
  rewardUnlock: sound(...arp([72, 76, 79, 84, 79, 84], (f, at) => sq(f, at, 0.08, 0.11), 0.08)),
  setComplete: sound(
    ...arp([67, 72, 76, 79, 84, 88], (f, at) => sq(f, at, 0.08, 0.11), 0.08),
    tri(m(48), 0, 0.5, 0.18),
  ),
  levelUp: sound(...arp([60, 64, 67, 72, 76, 79, 84, 88], (f, at) => sq(f, at, 0.07, 0.11), 0.06)),
  homeEnter: sound(...arp([72, 76, 79, 84], (f, at) => sq(f, at, 0.06, 0.11), 0.06)),
  nodePop: sound(sq(m(72), 0, 0.04, 0.11)),
  locked: sound(sq(m(52), 0, 0.08, 0.12), sq(m(47), 0.08, 0.12, 0.12)),
  stylesUnlocked: stylesUnlockedReveal,
};

// ---- Doodle Diary: pencil, paper and biro ----
/** A pencil scratch: a short narrow band of noise. */
const scratch = (freq: number, at: number, dur = 0.1, peak = 0.18, glideTo?: number) =>
  nz('bandpass', freq, at, dur, peak, { q: 3, glideTo });
/** A page turning: a wide sweep of noise. */
const pageFlip = (at: number, dur = 0.3, peak = 0.18) =>
  nz('bandpass', 700, at, dur, peak, { glideTo: 3500, q: 0.6, attack: 0.05 });

const dsound = louder(1.35);
const doodleDiary: Record<BaseEvent, SoundFn> = {
  // A biro click: a tiny bright tick (triangle, not square, in this style).
  buttonPress: dsound(nz('highpass', 5000, 0, 0.02, 0.3), tri(1800, 0.015, 0.015, 0.08)),
  cardFlip: dsound(
    nz('bandpass', 900, 0, 0.18, 0.2, { glideTo: 3500, q: 0.6 }),
    scratch(2400, 0.14, 0.04, 0.12),
  ),
  correct: dsound(
    scratch(2600, 0, 0.12),
    scratch(3200, 0.12, 0.12, 0.15),
    tri(m(79), 0.22, 0.25, 0.15),
  ),
  // A soft rub of the eraser and a low "hmm".
  wrong: dsound(nz('bandpass', 1200, 0, 0.12, 0.12, { q: 2 }), sin(m(64), 0.05, 0.28, 0.16, m(60))),
  combo: dsound(tri(m(81), 0.06, 0.18, 0.15), scratch(2400, 0, 0.08)),
  xpTick: dsound(nz('bandpass', 3500, 0, 0.02, 0.1, { q: 5 })),
  ringFill: dsound(scratch(2000, 0, 0.22, 0.12, 3500)),
  rewardWobble: dsound(
    scratch(2200, 0, 0.05, 0.14),
    scratch(2800, 0.07, 0.05, 0.14),
    scratch(2400, 0.14, 0.05, 0.14),
  ),
  rewardOpen: dsound(...[2500, 2900, 2600, 3100].map((f, i) => scratch(f, i * 0.1))),
  // The scribble flourish: a page lifts, three quick pen strokes, then a little tune.
  rewardUnlock: dsound(
    pageFlip(0),
    scratch(2400, 0.1, 0.07, 0.16, 3400),
    scratch(3000, 0.18, 0.07, 0.16, 2200),
    scratch(2600, 0.26, 0.07, 0.16, 3800),
    ...arp([72, 76, 79, 84], (f, at) => tri(f, at, 0.25, 0.15), 0.08, 0.3),
  ),
  setComplete: dsound(
    scratch(2600, 0, 0.1, 0.15),
    ...arp([72, 76, 79], (f, at) => tri(f, at, 0.3, 0.17), 0.12, 0.1),
  ),
  levelUp: dsound(
    pageFlip(0),
    ...arp([67, 72, 76, 79, 84], (f, at) => tri(f, at, 0.3, 0.17), 0.09, 0.2),
  ),
  homeEnter: dsound(pageFlip(0, 0.35, 0.2)),
  nodePop: dsound(nz('bandpass', 2800, 0, 0.04, 0.15, { q: 4 })),
  // A rubber squeak on the page: "not yet".
  locked: dsound(
    nz('bandpass', 1500, 0, 0.06, 0.18, { q: 2 }),
    nz('bandpass', 1300, 0.08, 0.06, 0.18, { q: 2 }),
    tri(560, 0.02, 0.1, 0.1, 660),
  ),
  stylesUnlocked: stylesUnlockedReveal,
};

// ---- Petal Glow: music box, sparkle and petals ----
const petalGlow: Record<BaseEvent, SoundFn> = {
  buttonPress: sound(sin(m(98), 0, 0.05, 0.1)),
  cardFlip: sound(swish(0, 0.1), sin(m(91), 0.04, 0.1, 0.08)),
  correct: sound(...bell(m(84), 0, 0.3, 0.22), ...bell(m(88), 0.09, 0.4, 0.2)),
  wrong: sound(sin(m(76), 0, 0.35, 0.16, m(72), 0.05)),
  combo: sound(...bell(m(86), 0, 0.25, 0.2), ...bell(m(93), 0.07, 0.3, 0.17)),
  xpTick: sound(sin(m(103), 0, 0.03, 0.07)),
  ringFill: sound(sin(m(91), 0, 0.12, 0.08, m(95))),
  rewardWobble: sound(
    sin(m(93), 0, 0.06, 0.1),
    sin(m(91), 0.06, 0.06, 0.1),
    sin(m(93), 0.12, 0.08, 0.1),
  ),
  rewardOpen: sound(
    sin(m(84), 0, 0.7, 0.2, undefined, 0.25),
    swish(0.2),
    ...bell(m(96), 0.4, 0.3, 0.12),
    ...bell(m(100), 0.5, 0.3, 0.1),
  ),
  rewardUnlock: sound(
    ...arp([84, 88, 91, 96], (f, at) => bell(f, at, 0.5, 0.17), 0.09).flat(),
    swish(0),
  ),
  setComplete: sound(...arp([79, 84, 88, 91], (f, at) => bell(f, at, 0.6, 0.16), 0.12).flat()),
  levelUp: sound(
    sin(m(72), 0, 1.1, 0.14, undefined, 0.3),
    ...arp([79, 84, 88, 91, 96], (f, at) => bell(f, at, 0.7, 0.15), 0.1).flat(),
  ),
  homeEnter: sound(swish(0), ...arp([88, 91], (f, at) => bell(f, at, 0.4, 0.12), 0.1, 0.08).flat()),
  nodePop: sound(sin(m(93), 0, 0.08, 0.1)),
  locked: sound(sin(m(67), 0, 0.2, 0.14, m(64), 0.04)),
  stylesUnlocked: stylesUnlockedReveal,
};

// ---- Turbo Drive: bold, sporty, mechanical ----
const turboDrive: Record<BaseEvent, SoundFn> = {
  buttonPress: sound(click(0), tri(1200, 0, 0.02, 0.06)),
  cardFlip: sound(whoosh(0, 0.12, 0.18)),
  correct: sound(tri(m(67), 0, 0.08, 0.22), tri(m(74), 0.07, 0.18, 0.22)),
  // Low and soft, never a buzzer.
  wrong: sound(sin(m(55), 0, 0.25, 0.2, m(50))),
  combo: sound(tri(m(64), 0, 0.1, 0.2, m(69)), click(0)),
  xpTick: sound(tri(1800, 0, 0.02, 0.07)),
  ringFill: sound(tri(m(60), 0, 0.18, 0.1, m(72))),
  rewardWobble: sound(
    tri(m(55), 0, 0.06, 0.14),
    tri(m(50), 0.07, 0.06, 0.14),
    tri(m(55), 0.14, 0.06, 0.14),
  ),
  rewardOpen: sound(thump(0), whoosh(0.05, 0.3, 0.22), ...stab(m(60), 0.3)),
  rewardUnlock: sound(thump(0), whoosh(0, 0.35, 0.2), ...stab(m(60), 0.3), ...stab(m(67), 0.42)),
  setComplete: sound(
    thump(0),
    thump(0.15),
    whoosh(0.1, 0.3, 0.18),
    ...stab(m(55), 0.35),
    ...stab(m(62), 0.5),
  ),
  levelUp: sound(
    thump(0),
    thump(0.12),
    thump(0.24),
    whoosh(0, 0.45, 0.2),
    ...stab(m(55), 0.45),
    ...stab(m(60), 0.6),
    ...stab(m(67), 0.75),
  ),
  homeEnter: sound(whoosh(0, 0.3, 0.2), thump(0.25, 0.3)),
  nodePop: sound(click(0), tri(m(72), 0, 0.05, 0.1)),
  locked: sound(sin(130, 0, 0.1, 0.25, 90), click(0.1)),
  stylesUnlocked: stylesUnlockedReveal,
};

// ---- Rainbow Parade: joyful major-scale colour runs ----
const sparkle = (at: number) => nz('highpass', 5000, at, 0.3, 0.08, { attack: 0.02 });
const rainbowParade: Record<BaseEvent, SoundFn> = {
  buttonPress: sound(tri(m(84), 0, 0.06, 0.14)),
  cardFlip: sound(tri(m(76), 0, 0.05, 0.12), tri(m(79), 0.04, 0.06, 0.12)),
  correct: sound(tri(m(72), 0, 0.1, 0.2), tri(m(76), 0.07, 0.1, 0.2), tri(m(79), 0.14, 0.25, 0.22)),
  wrong: sound(sin(m(65), 0, 0.3, 0.18, m(62))),
  combo: sound(...arp([76, 79, 84], (f, at) => tri(f, at, 0.15, 0.18), 0.05)),
  xpTick: sound(tri(m(98), 0, 0.025, 0.07)),
  ringFill: sound(tri(m(79), 0, 0.15, 0.1, m(84))),
  rewardWobble: sound(
    tri(m(79), 0, 0.06, 0.12),
    tri(m(81), 0.06, 0.06, 0.12),
    tri(m(79), 0.12, 0.06, 0.12),
  ),
  rewardOpen: sound(sparkle(0), ...arp([72, 76, 79, 84], (f, at) => tri(f, at, 0.2, 0.18), 0.06)),
  rewardUnlock: sound(
    ...arp(RAINBOW, (f, at) => tri(f, at, 0.25, 0.16), 0.06),
    sin(m(96), 0.5, 0.4, 0.1),
  ),
  setComplete: sound(...arp([72, 76, 79, 84, 88], (f, at) => tri(f, at, 0.3, 0.17), 0.1)),
  levelUp: sound(
    ...arp(RAINBOW.slice(0, 7), (f, at) => tri(f, at, 0.25, 0.16), 0.08),
    sin(m(84), 0.6, 0.7, 0.16),
    sin(m(88), 0.6, 0.7, 0.14),
    sin(m(91), 0.6, 0.7, 0.14),
  ),
  homeEnter: sound(sparkle(0), ...arp([72, 76, 79], (f, at) => tri(f, at, 0.2, 0.14), 0.06)),
  nodePop: sound(tri(m(84), 0, 0.06, 0.12)),
  locked: sound(sin(m(60), 0, 0.18, 0.16)),
  stylesUnlocked: stylesUnlockedReveal,
};

/** Every style before U8's juice layers (exported so tests can check what U8 adds). */
export const basePacks: Record<FeedbackStyle, Record<BaseEvent, SoundFn>> = {
  'sticker-book': stickerBook,
  'pop-burst': popBurst,
  starlight,
  'comic-pop': comicPop,
  'garden-grow': gardenGrow,
  'pixel-arcade': pixelArcade,
  'doodle-diary': doodleDiary,
  'petal-glow': petalGlow,
  'turbo-drive': turboDrive,
  'rainbow-parade': rainbowParade,
};

// ---- U8: juice. Pops, whizzes, sparkles and fizz, each in its style's own flavour ----
type Part = N | Noise;
interface Flavour {
  /** One pop at `at`; `p` shifts its pitch (1 = as written). */
  pop: (at: number, p?: number) => Part[];
  /** A sweep over `dur` seconds: rising when `up`, falling otherwise. */
  whizz: (at: number, dur: number, up: boolean) => Part[];
  /** A quick tinkle of three sparkles. */
  sparkle: (at: number) => Part[];
  /** A short fizz burst. */
  fizz: (at: number) => Part[];
  /** A soft page-turn whoosh. */
  whoosh: (at: number) => Part[];
}

const FLAVOURS: Record<FeedbackStyle, Flavour> = {
  // Paper pocks and peel sweeps.
  'sticker-book': {
    pop: (at, p = 1) => [sin(420 * p, at, 0.06, 0.3, 900 * p), tri(2600 * p, at, 0.015, 0.08)],
    whizz: (at, d, up) => [tri(up ? 700 : 1800, at, d, 0.14, up ? 1800 : 700)],
    sparkle: (at) => [
      tri(2637, at, 0.05, 0.08),
      tri(3136, at + 0.04, 0.05, 0.07),
      tri(3520, at + 0.08, 0.06, 0.06),
    ],
    fizz: (at) => [nz('bandpass', 3000, at, 0.15, 0.12, { q: 0.8, glideTo: 5000 })],
    whoosh: (at) => [nz('bandpass', 900, at, 0.22, 0.12, { glideTo: 2600, q: 0.7 })],
  },
  // Coin pops, a slide whistle and bubble blips.
  'pop-burst': {
    pop: (at, p = 1) => [
      sin(988 * p, at, 0.05, 0.28, 1320 * p),
      tri(1976 * p, at + 0.03, 0.12, 0.1),
    ],
    whizz: (at, d, up) => [sin(up ? 500 : 1500, at, d, 0.16, up ? 1500 : 500)],
    sparkle: (at) => [
      sin(1400, at, 0.03, 0.1, 2100),
      sin(1700, at + 0.04, 0.03, 0.1, 2500),
      sin(2000, at + 0.08, 0.03, 0.1, 3000),
    ],
    fizz: (at) => [nz('highpass', 4000, at, 0.15, 0.1)],
    whoosh: (at) => [
      nz('bandpass', 700, at, 0.2, 0.12, { glideTo: 2200 }),
      sin(300, at, 0.15, 0.08, 600),
    ],
  },
  // Glassy chime pops and shimmer sweeps.
  starlight: {
    pop: (at, p = 1) => [sin(1568 * p, at, 0.12, 0.22), tri(3136 * p, at, 0.06, 0.05)],
    whizz: (at, d, up) => [
      nz('highpass', up ? 3000 : 7000, at, d, 0.07, { glideTo: up ? 7000 : 3000 }),
      sin(up ? 1046.5 : 2093, at, d, 0.08, up ? 2093 : 1046.5),
    ],
    sparkle: (at) => [
      sin(2093, at, 0.1, 0.09),
      sin(2637, at + 0.04, 0.1, 0.08),
      sin(3136, at + 0.08, 0.12, 0.07),
    ],
    fizz: (at) => [nz('highpass', 6000, at, 0.2, 0.06, { attack: 0.03 })],
    whoosh: (at) => [nz('bandpass', 1500, at, 0.25, 0.08, { glideTo: 4000, attack: 0.05 })],
  },
  // Square blips with a POW, and noisy whooshes.
  'comic-pop': {
    pop: (at, p = 1) => [
      sq(220 * p, at, 0.04, 0.1, 440 * p),
      nz('lowpass', 2500, at, 0.06, 0.25, { glideTo: 400 }),
    ],
    whizz: (at, d, up) => [
      nz('bandpass', up ? 400 : 3000, at, d, 0.2, { glideTo: up ? 3000 : 400, q: 1.2 }),
    ],
    sparkle: (at) => [
      sq(1568, at, 0.03, 0.07),
      sq(2093, at + 0.04, 0.03, 0.07),
      sq(2637, at + 0.08, 0.03, 0.06),
    ],
    fizz: (at) => [nz('bandpass', 2500, at, 0.12, 0.15)],
    whoosh: (at) => [nz('bandpass', 400, at, 0.2, 0.16, { glideTo: 3000 })],
  },
  // Seed pops, breezes and chimes.
  'garden-grow': {
    pop: (at, p = 1) => [
      tri(600 * p, at, 0.05, 0.18, 300 * p),
      nz('bandpass', 1800, at, 0.03, 0.1, { q: 3 }),
    ],
    whizz: (at, d, up) => [
      nz('bandpass', up ? 600 : 2500, at, d, 0.1, { glideTo: up ? 2500 : 600, q: 0.6 }),
    ],
    sparkle: (at) => [
      tri(m(88), at, 0.08, 0.08),
      tri(m(91), at + 0.04, 0.08, 0.08),
      tri(m(96), at + 0.08, 0.1, 0.07),
    ],
    fizz: (at) => [nz('highpass', 5000, at, 0.15, 0.05)],
    whoosh: (at) => [nz('bandpass', 500, at, 0.25, 0.1, { glideTo: 1800, q: 0.5 })],
  },
  // Chiptune blips and sweeps, plus the noise channel.
  'pixel-arcade': {
    pop: (at, p = 1) => [sq(m(72) * p, at, 0.04, 0.1, m(84) * p)],
    whizz: (at, d, up) => [sq(up ? m(60) : m(84), at, d, 0.08, up ? m(84) : m(60))],
    sparkle: (at) => [
      sq(m(96), at, 0.03, 0.06),
      sq(m(100), at + 0.03, 0.03, 0.06),
      sq(m(103), at + 0.06, 0.03, 0.06),
    ],
    fizz: (at) => [nz('highpass', 3000, at, 0.08, 0.12)],
    whoosh: (at) => [sq(m(72), at, 0.12, 0.06, m(60)), nz('highpass', 2000, at, 0.1, 0.06)],
  },
  // Pencil taps, scribble sweeps and eraser crumbs.
  'doodle-diary': {
    pop: (at, p = 1) => [
      nz('bandpass', 3200 * p, at, 0.025, 0.3, { q: 6 }),
      tri(1400 * p, at + 0.01, 0.03, 0.08),
    ],
    whizz: (at, d, up) => [
      nz('bandpass', up ? 1500 : 4000, at, d, 0.16, { glideTo: up ? 4000 : 1500, q: 2.5 }),
    ],
    sparkle: (at) => [
      nz('bandpass', 3600, at, 0.02, 0.12, { q: 5 }),
      nz('bandpass', 4200, at + 0.04, 0.02, 0.12, { q: 5 }),
      nz('bandpass', 3900, at + 0.08, 0.02, 0.12, { q: 5 }),
    ],
    fizz: (at) => [nz('bandpass', 2800, at, 0.15, 0.1, { q: 1.5 })],
    whoosh: (at) => [nz('bandpass', 700, at, 0.25, 0.14, { glideTo: 3500, q: 0.6 })],
  },
  // Soft bubble pops, airy swishes and bells.
  'petal-glow': {
    pop: (at, p = 1) => [
      sin(1046.5 * p, at, 0.07, 0.16, 1568 * p),
      sin(2093 * p, at + 0.02, 0.1, 0.05),
    ],
    whizz: (at, d, up) => [
      nz('bandpass', up ? 2500 : 6000, at, d, 0.07, { glideTo: up ? 6000 : 2500, q: 1.5 }),
      sin(up ? 1318.5 : 2637, at, d, 0.05, up ? 2637 : 1318.5),
    ],
    sparkle: (at) => [
      sin(m(96), at, 0.1, 0.07, undefined, 0.01),
      sin(m(100), at + 0.04, 0.1, 0.07, undefined, 0.01),
      sin(m(103), at + 0.08, 0.12, 0.06, undefined, 0.01),
    ],
    fizz: (at) => [nz('highpass', 6500, at, 0.18, 0.04, { attack: 0.03 })],
    whoosh: (at) => [nz('bandpass', 3000, at, 0.25, 0.07, { glideTo: 6000, q: 1.5 })],
  },
  // Click-thump pops and engine whooshes.
  'turbo-drive': {
    pop: (at, p = 1) => [sin(180 * p, at, 0.07, 0.2, 70 * p), nz('highpass', 5000, at, 0.012, 0.2)],
    whizz: (at, d, up) => [
      nz('bandpass', up ? 300 : 3500, at, d, 0.16, { glideTo: up ? 3500 : 300, q: 0.9 }),
      tri(up ? 110 : 440, at, d, 0.1, up ? 440 : 110),
    ],
    sparkle: (at) => [
      nz('highpass', 6000, at, 0.012, 0.18),
      nz('highpass', 6000, at + 0.03, 0.012, 0.18),
      tri(1760, at + 0.06, 0.04, 0.06),
    ],
    fizz: (at) => [nz('bandpass', 1200, at, 0.12, 0.15, { q: 0.6 })],
    whoosh: (at) => [
      nz('bandpass', 350, at, 0.22, 0.18, { glideTo: 2800, q: 0.8 }),
      tri(90, at, 0.18, 0.08, 160),
    ],
  },
  // Bright colour pops and rainbow slides.
  'rainbow-parade': {
    pop: (at, p = 1) => [
      tri(m(84) * p, at, 0.06, 0.2, m(91) * p),
      sin(m(96) * p, at + 0.02, 0.08, 0.06),
    ],
    whizz: (at, d, up) => [tri(up ? m(72) : m(96), at, d, 0.12, up ? m(96) : m(72))],
    sparkle: (at) => [
      tri(m(91), at, 0.05, 0.08),
      tri(m(95), at + 0.04, 0.05, 0.08),
      tri(m(98), at + 0.08, 0.06, 0.07),
    ],
    fizz: (at) => [nz('highpass', 5000, at, 0.15, 0.06)],
    whoosh: (at) => [tri(m(79), at, 0.15, 0.08, m(84)), nz('highpass', 4000, at, 0.15, 0.04)],
  },
};

/** A run of pops, each a little higher: the payoff after a whizz. */
const cascade = (f: Flavour, at: number, count: number, gap = 0.07): Part[] =>
  Array.from({ length: count }, (_, i) => f.pop(at + i * gap, 1 + i * 0.1)).flat();

/** Plays a base sound and extra juice together (base first, so its character leads). */
const layer =
  (base: SoundFn, ...extra: Part[]): SoundFn =>
  (ctx, out, at, pitch = 1) =>
    Math.max(base(ctx, out, at, pitch), sound(...extra)(ctx, out, at, pitch));

/** The reveal's juice is the same in every style: a rainbow of pops around the chord. */
const revealJuice = cascade(FLAVOURS['rainbow-parade'], 1.42, 6, 0.06);
const juicedReveal: SoundFn = (ctx, out, at, pitch = 1) =>
  // Juice first here, so the reveal still ends on its held chord.
  Math.max(
    sound(...revealJuice, ...FLAVOURS['rainbow-parade'].fizz(1.5))(ctx, out, at, pitch),
    stylesUnlockedReveal(ctx, out, at, pitch),
  );

function juice(base: Record<BaseEvent, SoundFn>, f: Flavour): Record<FeedbackEvent, SoundFn> {
  return {
    ...base,
    correct: layer(base.correct, ...f.pop(0.02), ...f.sparkle(0.08)),
    combo: layer(base.combo, ...f.whizz(0, 0.18, true)),
    setComplete: layer(base.setComplete, ...f.whizz(0, 0.25, true), ...cascade(f, 0.28, 4)),
    levelUp: layer(base.levelUp, ...f.whizz(0, 0.35, true), ...cascade(f, 0.38, 6), ...f.fizz(0.8)),
    // The prize box: a rattle, a big POP, then each reward popping out.
    rewardWobble: layer(
      base.rewardWobble,
      ...f.pop(0, 0.9),
      ...f.pop(0.05, 1.1),
      ...f.pop(0.1, 0.95),
    ),
    rewardOpen: layer(base.rewardOpen, ...f.pop(0, 0.8), ...f.fizz(0.02), ...f.sparkle(0.1)),
    rewardUnlock: layer(base.rewardUnlock, ...cascade(f, 0.1, 4, 0.09), ...f.sparkle(0.5)),
    stylesUnlocked: juicedReveal,
    goalHit: sound(...f.whizz(0, 0.3, true), ...cascade(f, 0.32, 5), ...f.sparkle(0.7)),
    nodeComplete: sound(...f.pop(0), ...f.pop(0.08, 1.25), ...f.sparkle(0.15)),
    pageTransition: sound(...f.whoosh(0)),
    particleBurst: sound(...f.pop(0), ...f.fizz(0.01)),
    prizeBox: sound(...f.pop(0), ...f.sparkle(0.04)),
  };
}

export const stylePacks: Record<FeedbackStyle, Record<FeedbackEvent, SoundFn>> = Object.fromEntries(
  FEEDBACK_STYLES.map((id) => [id, juice(basePacks[id], FLAVOURS[id])]),
) as Record<FeedbackStyle, Record<FeedbackEvent, SoundFn>>;
