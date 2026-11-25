import {
  soundBank,
  type AudioNodeLike,
  type ParamLike,
  type SoundFn,
  type SynthContext,
} from './bank';
import { allowedInMode, type SoundEvent, type SoundMode } from './events';
import { rewardSound } from './rewardBank';
import {
  biggestReward,
  pickVariation,
  rewardSoundSpec,
  VARIATIONS_PER_TIER,
  type EarnedReward,
  type RewardSoundSpec,
  type RewardTier,
} from './rewardSounds';
import type { SoundSettings, SoundVolume } from './settings';

/** The parts of the browser's AudioContext the engine uses (a fake one in tests). */
export interface AudioContextLike extends SynthContext {
  state: string;
  currentTime: number;
  destination: AudioNodeLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  createBiquadFilter(): AudioNodeLike & {
    type: string;
    frequency: { value: number };
  };
}

/** Master loudness for each volume setting. */
export const VOLUME_LEVELS: Record<SoundVolume, number> = { low: 0.12, medium: 0.25, high: 0.45 };

export interface SoundEngineDeps {
  /** Makes the one AudioContext; null when the browser has no Web Audio. */
  createContext: () => AudioContextLike | null;
  settings: () => SoundSettings;
  /** True while the app is in the background. */
  isHidden: () => boolean;
  /** `navigator.audioSession` where the browser has it (Safari). */
  audioSession?: { type: string } | undefined;
  /** Randomness for picking reward variations, returning [0, 1). Injected so tests repeat. */
  random?: () => number;
}

/** What a reward sound played: its spec and the variation chosen. */
export type PlayedReward = RewardSoundSpec & { variation: number };

export interface PlayOptions {
  mode?: SoundMode;
  /** Seconds to wait before the sound starts (to follow another sound). */
  delay?: number;
}

export interface SoundEngine {
  /** Call on every user gesture: the first one allows sound; later ones wake audio up. */
  unlock(): void;
  /** Plays a sound if settings, mode and browser allow it. Returns whether it played. */
  play(event: SoundEvent, options?: PlayOptions): boolean;
  /** Pauses audio, e.g. when the app goes into the background. */
  suspend(): void;
  /**
   * Plays one sound for newly earned rewards: only the biggest, after any sound still playing
   * (such as the lesson's result). Returns what played, or null if nothing did.
   */
  playReward(rewards: readonly EarnedReward[], options?: PlayOptions): PlayedReward | null;
  /** Plays the next variation of a tier (the Settings sample buttons). */
  sampleReward(tier: RewardTier): PlayedReward | null;
  /** Skips a legendary sound that is playing (a tap). Returns whether one was skipped. */
  skip(): boolean;
}

/**
 * Plays the sound bank. Creates a single AudioContext lazily, only after the first user gesture
 * and only while sound is on, and resumes it on demand. Never throws: sound must not break the app.
 */
export function createSoundEngine(deps: SoundEngineDeps): SoundEngine {
  let unlocked = false;
  let ctx: AudioContextLike | null = null;
  let master: (AudioNodeLike & { gain: { value: number } }) | null = null;
  let failed = false;
  /** When the last sound ends, so a reward sound can follow it instead of piling on. */
  let busyUntil = 0;
  const lastVariation = new Map<RewardTier, number>();
  /** The legendary sound playing now, which a tap can skip. */
  let skippable: { voice: AudioNodeLike & { gain: ParamLike }; until: number } | null = null;
  const random = deps.random ?? Math.random;

  function context(): AudioContextLike | null {
    if (ctx || failed) return ctx;
    try {
      // Follow the iPhone/iPad silent switch and mix with other audio instead of interrupting it.
      if (deps.audioSession) deps.audioSession.type = 'ambient';
    } catch {
      // Not supported: carry on.
    }
    try {
      ctx = deps.createContext();
    } catch {
      ctx = null;
    }
    if (!ctx) {
      failed = true;
      return null;
    }
    master = ctx.createGain();
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 6000;
    master.connect(soften).connect(ctx.destination);
    return ctx;
  }

  function wake(audio: AudioContextLike) {
    if (audio.state !== 'running') audio.resume().catch(() => undefined);
  }

  /** Plays a sound function through its own volume, after anything still playing if `follow`. */
  function run(fn: SoundFn, delay: number, follow = false) {
    const settings = deps.settings();
    if (!unlocked || !settings.enabled || deps.isHidden()) return null;
    const audio = context();
    if (!audio || !master) return null;
    try {
      wake(audio);
      master.gain.value = VOLUME_LEVELS[settings.volume];
      const voice = audio.createGain();
      voice.connect(master);
      const start = Math.max(audio.currentTime + delay, follow ? busyUntil : 0);
      const end = fn(audio, voice, start);
      busyUntil = Math.max(busyUntil, end);
      return { voice, end };
    } catch {
      return null;
    }
  }

  function reward(spec: RewardSoundSpec, delay: number): PlayedReward | null {
    const variation = pickVariation(
      VARIATIONS_PER_TIER,
      lastVariation.get(spec.tier) ?? null,
      random,
    );
    const played = run(rewardSound(spec, variation), delay, true);
    if (!played) return null;
    lastVariation.set(spec.tier, variation);
    if (spec.tier === 'legendary') skippable = { voice: played.voice, until: played.end };
    return { ...spec, variation };
  }

  return {
    unlock() {
      unlocked = true;
      if (!deps.settings().enabled || deps.isHidden()) return;
      const audio = context();
      if (audio) wake(audio);
    },
    play(event, options = {}) {
      const settings = deps.settings();
      if (event === 'tap' && !settings.taps) return false;
      if (!allowedInMode(event, options.mode)) return false;
      return run(soundBank[event], options.delay ?? 0) !== null;
    },
    playReward(rewards, options = {}) {
      const biggest = biggestReward(rewards);
      if (!biggest || !allowedInMode('rewardUnlocked', options.mode)) return null;
      return reward(rewardSoundSpec(biggest), options.delay ?? 0);
    },
    sampleReward(tier) {
      return reward({ tier, step: 0, voice: 'standard', fanfare: null }, 0);
    },
    skip() {
      if (!ctx || !skippable || ctx.currentTime >= skippable.until) return false;
      const now = ctx.currentTime;
      const { gain } = skippable.voice;
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0, now + 0.06);
      skippable = null;
      busyUntil = now;
      return true;
    },
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => undefined);
    },
  };
}
