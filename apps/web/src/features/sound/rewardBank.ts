/**
 * Reward sounds, synthesised at runtime with the Web Audio API (no files). Four tiers that grow
 * with the reward, four variations each, a climbing pitch and fullness for ladder steps, a voice
 * per year chapter and unique fanfares for the GCSE and A-Level finisher sets.
 */
import { note, type Note, type SoundFn } from './bank';
import type { RewardSoundSpec, RewardTier, RewardVoice } from './rewardSounds';

/** Longest each tier may run, in seconds. Legendary is at most 3 s (and can be skipped). */
export const TIER_MAX_SECONDS: Record<RewardTier, number> = {
  common: 0.7,
  rare: 1.2,
  epic: 1.8,
  legendary: 3,
};

/** One played pitch: semitones above the tier's base note, start time, length and loudness. */
interface Hit {
  semi: number;
  at: number;
  dur: number;
  peak?: number;
}

interface Partial {
  ratio: number;
  gain: number;
  wave: 'sine' | 'triangle';
}

/** Each voice is a small recipe of soft partials, so chapters sound clearly different. */
const VOICES: Record<RewardVoice, Partial[]> = {
  standard: [
    { ratio: 1, gain: 1, wave: 'sine' },
    { ratio: 2, gain: 0.18, wave: 'triangle' },
  ],
  // Year 9: bright and plucky.
  chapter1: [
    { ratio: 1, gain: 1, wave: 'triangle' },
    { ratio: 2, gain: 0.25, wave: 'sine' },
  ],
  // Year 10: hollow, like a soft clarinet.
  chapter2: [
    { ratio: 1, gain: 1, wave: 'sine' },
    { ratio: 3, gain: 0.16, wave: 'sine' },
  ],
  // Year 11: a gentle chorus of two close voices.
  chapter3: [
    { ratio: 1, gain: 0.8, wave: 'sine' },
    { ratio: 1.004, gain: 0.5, wave: 'sine' },
  ],
  // Year 12: warm, with a soft octave below.
  chapter4: [
    { ratio: 1, gain: 1, wave: 'triangle' },
    { ratio: 0.5, gain: 0.3, wave: 'sine' },
  ],
  // Year 13: an airy organ.
  chapter5: [
    { ratio: 1, gain: 0.9, wave: 'sine' },
    { ratio: 2, gain: 0.3, wave: 'sine' },
    { ratio: 3, gain: 0.15, wave: 'sine' },
  ],
};

const C5 = 523.25;
const hz = (semi: number) => C5 * 2 ** (semi / 12);

/** Ladder steps climb 1.5 semitones each (eight steps reach an octave) and add harmony. */
const STEP_SEMIS = 1.5;
const MAX_STEP = 8;
/** Extra harmony on the last note, added one per step (fuller as the ladder climbs). */
const HARMONY = [-12, 7, 12, 16];

const r = (semi: number, at: number, dur = 0.18, peak?: number): Hit => ({ semi, at, dur, peak });

/** Common: a bright chime, about half a second. */
const COMMON: Hit[][] = [
  [r(0, 0), r(7, 0.08, 0.42)],
  [r(4, 0), r(7, 0.06), r(12, 0.12, 0.4)],
  [r(7, 0), r(12, 0.09, 0.44)],
  [r(0, 0), r(4, 0.05), r(7, 0.1), r(12, 0.15, 0.38)],
];

/** Rare: a two-part motif, about one second. */
const RARE: Hit[][] = [
  [r(0, 0), r(4, 0.07), r(7, 0.14), r(5, 0.42), r(9, 0.5), r(12, 0.58, 0.5)],
  [r(0, 0, 0.24), r(7, 0.1, 0.24), r(4, 0.42, 0.24), r(12, 0.52, 0.55)],
  [r(2, 0), r(7, 0.1), r(0, 0.42), r(4, 0.48), r(7, 0.54), r(12, 0.6, 0.5)],
  [r(0, 0), r(4, 0.09), r(7, 0.42), r(11, 0.5), r(14, 0.58, 0.5)],
];

/** Epic: a rising run, a shimmer and a held top note, about one and a half seconds. */
function run(semis: number[]): Hit[] {
  const step = 0.08;
  const hits = semis.map((s, i) => r(s, i * step, 0.16, 0.4));
  const top = semis[semis.length - 1]!;
  const t = semis.length * step;
  hits[hits.length - 1] = r(top, (semis.length - 1) * step, 0.75, 0.5);
  for (let i = 0; i < 4; i++) hits.push(r(top + 12, t + i * 0.07, 0.3, 0.12));
  return hits;
}
const EPIC: Hit[][] = [
  run([0, 2, 4, 7, 9, 12, 16]),
  run([0, 4, 7, 11, 12, 16, 19]),
  run([0, 2, 5, 7, 9, 12, 14]),
  run([0, 5, 7, 12, 14, 17, 19]),
];

/** Legendary: a short fanfare with harmony, ending on a held chord over a low hit (under 3 s). */
interface Fanfare {
  melody: Hit[];
  /** When the final chord lands. */
  final: number;
  /** Semitones of the final chord, and how long it holds. */
  chord: number[];
  hold: number;
}
const fanfare = (melody: Hit[], final: number, top: number, hold = 1.6): Fanfare => ({
  melody,
  final,
  chord: [top - 12, top - 8, top - 5, top],
  hold,
});
const LEGENDARY: Fanfare[] = [
  fanfare([r(0, 0, 0.14), r(0, 0.16, 0.14), r(7, 0.32, 0.32)], 0.7, 12),
  fanfare([r(7, 0, 0.12), r(4, 0.14, 0.12), r(7, 0.28, 0.28)], 0.6, 12),
  fanfare([r(0, 0, 0.12), r(4, 0.12, 0.12), r(7, 0.24, 0.12), r(9, 0.36, 0.2)], 0.6, 12),
  fanfare([r(12, 0, 0.14), r(7, 0.15, 0.14), r(9, 0.3, 0.14), r(11, 0.45, 0.2)], 0.7, 12),
];
/** The finisher sets: their own melodies, in their own keys (D for GCSE, F for A-Level). */
const FINISHERS: Record<'gcse' | 'aLevel', Fanfare> = {
  gcse: fanfare(
    [r(2, 0, 0.12), r(7, 0.12, 0.12), r(9, 0.24, 0.12), r(14, 0.36, 0.14), r(9, 0.52, 0.14)],
    0.7,
    14,
    1.7,
  ),
  aLevel: fanfare(
    [r(5, 0, 0.12), r(12, 0.12, 0.12), r(17, 0.24, 0.12), r(21, 0.36, 0.14), r(24, 0.5, 0.16)],
    0.72,
    17,
    1.8,
  ),
};

function legendaryHits(f: Fanfare): Hit[] {
  const hits: Hit[] = [];
  for (const m of f.melody) {
    hits.push({ ...m, peak: 0.5 }, { ...m, semi: m.semi - 5, peak: 0.2 });
  }
  f.chord.forEach((semi, i) =>
    hits.push(r(semi, f.final, f.hold, i === f.chord.length - 1 ? 0.5 : 0.26)),
  );
  return hits;
}

function hitsFor(spec: RewardSoundSpec, variation: number): Hit[] {
  const v = ((variation % 4) + 4) % 4;
  switch (spec.tier) {
    case 'common':
      return COMMON[v]!;
    case 'rare':
      return RARE[v]!;
    case 'epic':
      return EPIC[v]!;
    case 'legendary':
      return legendaryHits(spec.fanfare ? FINISHERS[spec.fanfare] : LEGENDARY[v]!);
  }
}

/** The synthesised sound for a reward. Returns a sound function like the main bank's. */
export function rewardSound(spec: RewardSoundSpec, variation: number): SoundFn {
  const step = Math.max(0, Math.min(MAX_STEP, spec.step));
  const shift = step * STEP_SEMIS;
  const hits = hitsFor(spec, variation);
  const last = hits.reduce((a, b) => (b.at + b.dur >= a.at + a.dur ? b : a));
  const extra = HARMONY.slice(0, Math.min(step, HARMONY.length)).map((h) =>
    r(last.semi + h, last.at, last.dur, 0.18),
  );
  const partials = VOICES[spec.voice];
  const max = TIER_MAX_SECONDS[spec.tier];

  return (ctx, out, at) => {
    let end = at;
    const play = (n: Note) => {
      end = Math.max(end, note(ctx, out, at, { ...n, dur: Math.min(n.dur, max - 0.03 - n.at) }));
    };
    for (const hit of [...hits, ...extra]) {
      for (const p of partials) {
        play({
          freq: hz(hit.semi + shift) * p.ratio,
          at: hit.at,
          dur: hit.dur,
          peak: (hit.peak ?? 0.4) * p.gain,
          wave: p.wave,
        });
      }
    }
    if (spec.tier === 'legendary') {
      // A soft, low hit under the final chord: a sine dropping from G2 to A1.
      const f = spec.fanfare ? FINISHERS[spec.fanfare] : LEGENDARY[((variation % 4) + 4) % 4]!;
      play({ freq: 98, glideTo: 55, at: f.final, dur: 0.6, peak: 0.6 });
    }
    return end;
  };
}
