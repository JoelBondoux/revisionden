import type { SoundEvent } from './events';

/**
 * The sound bank: one original sound per event, synthesised at runtime with the Web Audio API.
 * No audio files and no third-party sounds. Every sound uses soft sine and triangle waves with
 * smooth envelopes, so nothing buzzes; "wrong" is low and quiet, never a buzzer.
 */

interface ParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
}

export interface AudioNodeLike {
  connect<T>(target: T): T;
}

export interface SynthContext {
  createOscillator(): AudioNodeLike & {
    type: string;
    frequency: ParamLike;
    start(when?: number): void;
    stop(when?: number): void;
  };
  createGain(): AudioNodeLike & { gain: ParamLike };
}

export type SoundFn = (ctx: SynthContext, out: AudioNodeLike, at: number) => void;

interface Note {
  /** Pitch in hertz. */
  freq: number;
  /** Start, in seconds after the sound begins. */
  at: number;
  /** Length in seconds, including the fade. */
  dur: number;
  /** Peak loudness, 0 to 1, before the master volume. */
  peak?: number;
  wave?: 'sine' | 'triangle';
  /** Slide to this pitch over the note (for swoops). */
  glideTo?: number;
}

/** One note with a quick soft attack and a smooth exponential fade (a gentle bell or pluck). */
function note(ctx: SynthContext, out: AudioNodeLike, start: number, n: Note) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const t0 = start + n.at;
  const end = t0 + n.dur;
  osc.type = n.wave ?? 'sine';
  osc.frequency.setValueAtTime(n.freq, t0);
  if (n.glideTo) osc.frequency.exponentialRampToValueAtTime(n.glideTo, end);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(n.peak ?? 0.6, t0 + Math.min(0.012, n.dur / 4));
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(env).connect(out);
  osc.start(t0);
  osc.stop(end + 0.02);
}

/** A bell-like note: the pitch plus a quiet triangle an octave up for shimmer. */
function bell(freq: number, at: number, dur: number, peak = 0.55): Note[] {
  return [
    { freq, at, dur, peak },
    { freq: freq * 2, at, dur: dur * 0.6, peak: peak * 0.18, wave: 'triangle' },
  ];
}

const sound =
  (...notes: Note[]): SoundFn =>
  (ctx, out, at) => {
    for (const n of notes) note(ctx, out, at, n);
  };

// Pitches (hertz), equal temperament.
const G3 = 196.0;
const C4 = 261.63;
const E4 = 329.63;
const G4 = 392.0;
const A4 = 440.0;
const B4 = 493.88;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.0;
const B5 = 987.77;
const C6 = 1046.5;
const CS6 = 1108.73;
const E6 = 1318.51;
const G6 = 1567.98;

export const soundBank: Record<SoundEvent, SoundFn> = {
  /** A tiny soft tick, well under a tenth of a second. */
  tap: sound({ freq: 1400, glideTo: 1000, at: 0, dur: 0.04, peak: 0.22 }),
  /** A bright rising fifth, like two little bells. */
  correct: sound(...bell(C5, 0, 0.22), ...bell(G5, 0.09, 0.32)),
  /** Two low, quiet notes falling gently: "not quite", never a buzzer. */
  wrong: sound(
    { freq: E4, at: 0, dur: 0.22, peak: 0.32 },
    { freq: C4, at: 0.13, dur: 0.32, peak: 0.28 },
  ),
  /** A rising major third: halfway between correct and wrong. */
  partMarks: sound(...bell(C5, 0, 0.2, 0.45), ...bell(E5, 0.1, 0.28, 0.45)),
  /** A soft upward swoop as answers are handed in. */
  submit: sound({ freq: D5, glideTo: A5, at: 0, dur: 0.18, peak: 0.4 }),
  /** A quick sparkling arpeggio as results appear. */
  reveal: sound(
    ...bell(C5, 0, 0.18, 0.45),
    ...bell(E5, 0.08, 0.18, 0.45),
    ...bell(G5, 0.16, 0.2, 0.45),
    ...bell(C6, 0.24, 0.45, 0.5),
  ),
  /** A warm chime for meeting the daily goal. */
  streakDay: sound(
    { freq: G4, at: 0, dur: 0.3, peak: 0.4, wave: 'triangle' },
    { freq: B4, at: 0.09, dur: 0.3, peak: 0.4, wave: 'triangle' },
    { freq: D5, at: 0.18, dur: 0.3, peak: 0.4, wave: 'triangle' },
    ...bell(G5, 0.27, 0.55, 0.5),
  ),
  /** A climbing arpeggio that lands on a held chord. */
  levelUp: sound(
    ...bell(C5, 0, 0.14, 0.4),
    ...bell(E5, 0.07, 0.14, 0.4),
    ...bell(G5, 0.14, 0.14, 0.4),
    ...bell(C6, 0.21, 0.7, 0.45),
    { freq: E5, at: 0.21, dur: 0.7, peak: 0.25, wave: 'triangle' },
    { freq: G5, at: 0.21, dur: 0.7, peak: 0.25, wave: 'triangle' },
  ),
  /** High shimmering sparkles. */
  rewardUnlocked: sound(
    ...bell(A5, 0, 0.2, 0.35),
    ...bell(E6, 0.07, 0.2, 0.3),
    ...bell(A5 * 2, 0.14, 0.5, 0.28),
  ),
  /** A soft "off it goes" lift. */
  giftSent: sound(...bell(A4, 0, 0.18, 0.4), {
    freq: E5,
    glideTo: A5,
    at: 0.1,
    dur: 0.25,
    peak: 0.35,
  }),
  /** A happy three-note "for you". */
  giftReceived: sound(
    ...bell(E5, 0, 0.16, 0.4),
    ...bell(A5, 0.08, 0.16, 0.4),
    ...bell(CS6, 0.16, 0.45, 0.4),
  ),
  /** A short airy swish as a card turns over. */
  cardFlip: sound({ freq: 520, glideTo: 880, at: 0, dur: 0.07, peak: 0.2, wave: 'triangle' }),
  /** A single soft pluck. */
  cardRated: sound(...bell(G5, 0, 0.12, 0.35)),
  /** A soft low "pop" as a session lands in the plan. */
  sessionDropped: sound(
    { freq: G3 * 2, glideTo: G3, at: 0, dur: 0.12, peak: 0.45 },
    { freq: G4, at: 0.02, dur: 0.1, peak: 0.12, wave: 'triangle' },
  ),
  /** A small fanfare: arpeggio up to a bright held chord. */
  celebration: sound(
    ...bell(G4, 0, 0.14, 0.4),
    ...bell(C5, 0.08, 0.14, 0.4),
    ...bell(E5, 0.16, 0.14, 0.4),
    ...bell(G5, 0.24, 0.14, 0.4),
    ...bell(C6, 0.32, 0.9, 0.45),
    { freq: E5, at: 0.32, dur: 0.9, peak: 0.22, wave: 'triangle' },
    { freq: G5, at: 0.32, dur: 0.9, peak: 0.22, wave: 'triangle' },
    ...bell(G6, 0.5, 0.4, 0.15),
  ),
  /** Two calm pings: one minute left. */
  timerWarning: sound(...bell(B5, 0, 0.2, 0.4), ...bell(B5, 0.28, 0.3, 0.4)),
};
