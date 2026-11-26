import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createSoundEngine,
  type AudioContextLike,
  type PlayedReward,
  type PlayOptions,
} from './engine';
import { createFeedback, type EmitOptions, type EmitResult } from './feedback/controller';
import { STYLED_SOUNDS, type FeedbackEvent } from './feedback/events';
import { createWebHaptics, type HapticsDriver } from './feedback/haptics';
import type { EarnedReward, RewardTier } from './rewardSounds';
import type { SoundEvent } from './events';
import {
  DEFAULT_SOUND_SETTINGS,
  loadSoundSettings,
  saveSoundSettings,
  type SettingsStorage,
  type SoundSettings,
} from './settings';

export interface SoundApi {
  /** Plays the sound for an event, if this device's settings allow it. Safe to call anywhere. */
  play(event: SoundEvent, options?: PlayOptions): boolean;
  settings: SoundSettings;
  /** Changes and saves this device's sound settings. */
  update(change: Partial<SoundSettings>): void;
  /** One sound for newly earned rewards: the biggest, after any sound still playing. */
  playReward(rewards: readonly EarnedReward[], options?: PlayOptions): PlayedReward | null;
  /** The next variation of a reward tier (Settings samples). */
  sampleReward(tier: RewardTier): PlayedReward | null;
  /**
   * The sound and vibration for an animation, in the active effect style. Fire it once as the
   * animation starts; throttling and every setting are handled here.
   */
  emit(event: FeedbackEvent, options?: EmitOptions): EmitResult;
  /** Sets the effect style (J's style system). Use `useFeedbackStyle` in components. */
  setStyle(id: string | null | undefined): void;
  /** False where this device cannot vibrate (iPhone and iPad browsers). */
  vibrationSupported: boolean;
}

const silent: SoundApi = {
  play: () => false,
  settings: DEFAULT_SOUND_SETTINGS,
  update: () => undefined,
  playReward: () => null,
  sampleReward: () => null,
  emit: () => ({ sound: false, haptic: false }),
  setStyle: () => undefined,
  vibrationSupported: false,
};

const SoundContext = createContext<SoundApi>(silent);

/** The sound controls for this device. Outside a `SoundProvider` every call is silent. */
export function useSound(): SoundApi {
  return useContext(SoundContext);
}

/** Keeps sounds and vibration in the effect style J's style system has chosen. */
export function useFeedbackStyle(id: string | null | undefined): void {
  const { setStyle } = useSound();
  useEffect(() => setStyle(id), [setStyle, id]);
}

/** True when the device asks for reduced motion (sounds then play softer). */
function browserReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

/** localStorage, or null where reading it throws (blocked site data). */
function browserStorage(): SettingsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The browser's AudioContext, or null where Web Audio is missing. */
function browserAudioContext(): AudioContextLike | null {
  const w = window as unknown as {
    AudioContext?: new () => AudioContextLike;
    webkitAudioContext?: new () => AudioContextLike;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

const GESTURES = ['pointerdown', 'keydown', 'touchend', 'click'] as const;
const SKIP_GESTURES = ['pointerdown', 'keydown'] as const;
const TAPPABLE =
  'button, a[href], [role="button"], [role="tab"], input[type="checkbox"], input[type="radio"]';

interface SoundProviderProps {
  children: ReactNode;
  storage?: SettingsStorage | null;
  createContext?: () => AudioContextLike | null;
  /** Randomness for reward variations, returning [0, 1). */
  random?: () => number;
  /** Vibration: `navigator.vibrate` by default; a native wrapper can pass real haptics. */
  haptics?: HapticsDriver;
  reducedMotion?: () => boolean;
}

/**
 * Sound for the whole app. Sound waits for the first tap or key press (a browser rule), pauses
 * while the app is in the background, and plays tap sounds on buttons when they are switched on.
 */
export function SoundProvider({
  children,
  storage = browserStorage(),
  createContext: makeContext = browserAudioContext,
  random = Math.random,
  haptics,
  reducedMotion = browserReducedMotion,
}: SoundProviderProps) {
  const [settings, setSettings] = useState(() => loadSoundSettings(storage));
  const current = useRef(settings);
  current.current = settings;

  // One engine (and so at most one AudioContext) for the provider's whole life.
  const [engine] = useState(() =>
    createSoundEngine({
      createContext: makeContext,
      settings: () => current.current,
      isHidden: () => document.visibilityState === 'hidden',
      audioSession: (navigator as { audioSession?: { type: string } }).audioSession,
      random,
    }),
  );
  const [feedback] = useState(() =>
    createFeedback({
      engine,
      settings: () => current.current,
      haptics:
        haptics ?? createWebHaptics(navigator as { vibrate?: (pattern: number[]) => boolean }),
      now: () => performance.now(),
      reducedMotion,
    }),
  );

  /** Older sound events that have a styled version go through feedback (sound + vibration). */
  const play = useCallback(
    (event: SoundEvent, options: PlayOptions = {}) => {
      const styled = STYLED_SOUNDS[event];
      if (!styled) return engine.play(event, options);
      const combo = styled === 'correct' && (options.step ?? 0) > 0;
      return feedback.emit(combo ? 'combo' : styled, options).sound;
    },
    [engine, feedback],
  );
  const playRef = useRef(play);
  playRef.current = play;

  useEffect(() => {
    const unlock = () => engine.unlock();
    // A tap or key press skips a legendary reward sound that is playing.
    const skip = () => void engine.skip();
    const tap = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.(TAPPABLE)) playRef.current('tap');
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') engine.suspend();
    };
    for (const g of GESTURES) window.addEventListener(g, unlock, true);
    for (const g of SKIP_GESTURES) window.addEventListener(g, skip, true);
    document.addEventListener('click', tap);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      for (const g of GESTURES) window.removeEventListener(g, unlock, true);
      for (const g of SKIP_GESTURES) window.removeEventListener(g, skip, true);
      document.removeEventListener('click', tap);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [engine]);

  const update = useCallback(
    (change: Partial<SoundSettings>) => {
      const next = { ...current.current, ...change };
      current.current = next;
      saveSoundSettings(storage, next);
      setSettings(next);
    },
    [storage],
  );

  const playReward = useCallback(
    (rewards: readonly EarnedReward[], options?: PlayOptions) => {
      const played = engine.playReward(rewards, options);
      if (played) feedback.vibrateFor(played.tier === 'common' ? 'rewardOpen' : 'rewardUnlock');
      return played;
    },
    [engine, feedback],
  );
  const emit = useCallback(
    (event: FeedbackEvent, options?: EmitOptions) => feedback.emit(event, options),
    [feedback],
  );
  const setStyle = useCallback(
    (id: string | null | undefined) => feedback.setStyle(id),
    [feedback],
  );
  const sampleReward = useCallback((tier: RewardTier) => engine.sampleReward(tier), [engine]);

  const api = useMemo(
    () => ({
      play,
      settings,
      update,
      playReward,
      sampleReward,
      emit,
      setStyle,
      vibrationSupported: feedback.vibrationSupported,
    }),
    [play, settings, update, playReward, sampleReward, emit, setStyle, feedback],
  );
  return <SoundContext.Provider value={api}>{children}</SoundContext.Provider>;
}
