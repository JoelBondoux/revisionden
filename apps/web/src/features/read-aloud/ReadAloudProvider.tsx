import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { mathsToSpeech } from './maths';
import {
  DEFAULT_READ_ALOUD_SETTINGS,
  isReadAloudOn,
  loadReadAloudSettings,
  saveReadAloudSettings,
  type ReadAloudSettings,
  type SettingsStorage,
} from './settings';
import { chooseVoice, type ChosenVoice, type SpeechLike, type UtteranceLike } from './voices';

export interface ReadAloudApi {
  /** False when the browser has no speech synthesis at all. */
  supported: boolean;
  voice: ChosenVoice | null;
  settings: ReadAloudSettings;
  /** Whether read aloud buttons show. */
  on: boolean;
  update(change: Partial<ReadAloudSettings>): void;
  /** Reads text aloud (maths read sensibly), stopping anything already speaking. */
  speak(text: string): void;
  stop(): void;
}

const ReadAloudContext = createContext<ReadAloudApi>({
  supported: false,
  voice: null,
  settings: DEFAULT_READ_ALOUD_SETTINGS,
  on: false,
  update: () => undefined,
  speak: () => undefined,
  stop: () => undefined,
});

export function useReadAloud(): ReadAloudApi {
  return useContext(ReadAloudContext);
}

function browserStorage(): SettingsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserSynth(): SpeechLike | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
    ? (window.speechSynthesis as unknown as SpeechLike)
    : null;
}

function browserUtterance(text: string): UtteranceLike {
  return new SpeechSynthesisUtterance(text) as unknown as UtteranceLike;
}

interface ReadAloudProviderProps {
  children: ReactNode;
  synth?: SpeechLike | null;
  makeUtterance?: (text: string) => UtteranceLike;
  storage?: SettingsStorage | null;
}

/** Read aloud with the device's own speech voices (Web Speech API). Nothing is sent by us. */
export function ReadAloudProvider({
  children,
  synth: givenSynth,
  makeUtterance = browserUtterance,
  storage,
}: ReadAloudProviderProps) {
  const synth = givenSynth === undefined ? browserSynth() : givenSynth;
  const store = storage === undefined ? browserStorage() : storage;
  const [settings, setSettings] = useState(() => loadReadAloudSettings(store));
  const [voice, setVoice] = useState(() => (synth ? chooseVoice(synth.getVoices()) : null));

  useEffect(() => {
    if (!synth) return undefined;
    const refresh = () => setVoice(chooseVoice(synth.getVoices()));
    refresh();
    synth.addEventListener('voiceschanged', refresh);
    return () => {
      synth.removeEventListener('voiceschanged', refresh);
      synth.cancel();
    };
  }, [synth]);

  const update = useCallback(
    (change: Partial<ReadAloudSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...change };
        saveReadAloudSettings(store, next);
        return next;
      });
    },
    [store],
  );

  const stop = useCallback(() => synth?.cancel(), [synth]);

  const speak = useCallback(
    (text: string) => {
      if (!synth || !voice) return;
      synth.cancel();
      const utterance = makeUtterance(mathsToSpeech(text));
      utterance.voice = voice.voice;
      utterance.lang = voice.voice.lang;
      utterance.rate = settings.rate;
      synth.speak(utterance);
    },
    [synth, voice, settings.rate, makeUtterance],
  );

  const api = useMemo(
    () => ({
      supported: synth !== null,
      voice,
      settings,
      on: isReadAloudOn(settings, voice),
      update,
      speak,
      stop,
    }),
    [synth, voice, settings, update, speak, stop],
  );
  return <ReadAloudContext.Provider value={api}>{children}</ReadAloudContext.Provider>;
}
