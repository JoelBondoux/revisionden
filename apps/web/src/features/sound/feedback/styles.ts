/**
 * One sound pack per effect style (J's styles), synthesised with Web Audio: no files.
 * Sticker Book: paper peel, slap, stamp, pencil tick. Pop Burst: bubbly pops and jelly boings.
 * Starlight: chimes, shimmer and soft swells. Comic Pop: punchy squares and whooshes.
 * Garden Grow: soft woodwind and chimes. Pixel Arcade: chiptune. Doodle Diary: pencil scratches,
 * page flips, biro clicks, a rubber squeak and a scribble flourish. Matched to J's mockup previews.
 * Short and volume-balanced; square waves only in Comic Pop and Pixel Arcade, always low-passed,
 * and "wrong" stays soft (sine or triangle) in every style.
 */
import { sound, type Noise, type Note, type SoundFn } from '../bank';
import type { FeedbackEvent } from './events';

export { SQUARE_LOWPASS_HZ } from '../bank';

export const FEEDBACK_STYLES = [
  'sticker-book',
  'pop-burst',
  'starlight',
  'comic-pop',
  'garden-grow',
  'pixel-arcade',
  'doodle-diary',
] as const;
export type FeedbackStyle = (typeof FEEDBACK_STYLES)[number];
/**
 * The style used until a child picks one. One value to change: Doodle Diary is built but waits
 * for the owner to approve J's mockup before it becomes the default.
 */
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

// ---- Comic Pop: punchy squares, whooshes and POWs ----
const comicPop: Record<FeedbackEvent, SoundFn> = {
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
};

// ---- Garden Grow: soft woodwind and chimes ----
/** A breathy woodwind note: swells in, with a faint airy overtone. */
const wood = (freq: number, at: number, dur: number, peak: number, glideTo?: number): N[] => [
  sin(freq, at, dur, peak, glideTo, Math.min(0.04, dur / 3)),
  tri(freq * 2, at, dur * 0.6, peak * 0.12, glideTo && glideTo * 2),
];

const gsound = louder(1.5);
const gardenGrow: Record<FeedbackEvent, SoundFn> = {
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
};

// ---- Pixel Arcade: chiptune ----
const pixelArcade: Record<FeedbackEvent, SoundFn> = {
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
};

// ---- Doodle Diary: pencil, paper and biro ----
/** A pencil scratch: a short narrow band of noise. */
const scratch = (freq: number, at: number, dur = 0.1, peak = 0.18, glideTo?: number) =>
  nz('bandpass', freq, at, dur, peak, { q: 3, glideTo });
/** A page turning: a wide sweep of noise. */
const pageFlip = (at: number, dur = 0.3, peak = 0.18) =>
  nz('bandpass', 700, at, dur, peak, { glideTo: 3500, q: 0.6, attack: 0.05 });

const dsound = louder(1.35);
const doodleDiary: Record<FeedbackEvent, SoundFn> = {
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
  combo: dsound(tri(m(74), 0.06, 0.18, 0.15), scratch(2400, 0, 0.08)),
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
};

export const stylePacks: Record<FeedbackStyle, Record<FeedbackEvent, SoundFn>> = {
  'sticker-book': stickerBook,
  'pop-burst': popBurst,
  starlight,
  'comic-pop': comicPop,
  'garden-grow': gardenGrow,
  'pixel-arcade': pixelArcade,
  'doodle-diary': doodleDiary,
};
