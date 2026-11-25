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
}

const silent: SoundApi = {
  play: () => false,
  settings: DEFAULT_SOUND_SETTINGS,
  update: () => undefined,
  playReward: () => null,
  sampleReward: () => null,
};

const SoundContext = createContext<SoundApi>(silent);

/** The sound controls for this device. Outside a `SoundProvider` every call is silent. */
export function useSound(): SoundApi {
  return useContext(SoundContext);
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

  useEffect(() => {
    const unlock = () => engine.unlock();
    // A tap or key press skips a legendary reward sound that is playing.
    const skip = () => void engine.skip();
    const tap = (event: Event) => {
      const target = event.target as Element | null;
      if (target?.closest?.(TAPPABLE)) engine.play('tap');
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

  const play = useCallback(
    (event: SoundEvent, options?: PlayOptions) => engine.play(event, options),
    [engine],
  );

  const playReward = useCallback(
    (rewards: readonly EarnedReward[], options?: PlayOptions) =>
      engine.playReward(rewards, options),
    [engine],
  );
  const sampleReward = useCallback((tier: RewardTier) => engine.sampleReward(tier), [engine]);

  const api = useMemo(
    () => ({ play, settings, update, playReward, sampleReward }),
    [play, settings, update, playReward, sampleReward],
  );
  return <SoundContext.Provider value={api}>{children}</SoundContext.Provider>;
}
