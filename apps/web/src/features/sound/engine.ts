import { soundBank, type AudioNodeLike, type SynthContext } from './bank';
import { allowedInMode, type SoundEvent, type SoundMode } from './events';
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
}

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

  return {
    unlock() {
      unlocked = true;
      if (!deps.settings().enabled || deps.isHidden()) return;
      const audio = context();
      if (audio) wake(audio);
    },
    play(event, options = {}) {
      const settings = deps.settings();
      if (!unlocked || !settings.enabled || deps.isHidden()) return false;
      if (event === 'tap' && !settings.taps) return false;
      if (!allowedInMode(event, options.mode)) return false;
      const audio = context();
      if (!audio || !master) return false;
      try {
        wake(audio);
        master.gain.value = VOLUME_LEVELS[settings.volume];
        soundBank[event](audio, master, audio.currentTime + (options.delay ?? 0));
        return true;
      } catch {
        return false;
      }
    },
    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => undefined);
    },
  };
}
