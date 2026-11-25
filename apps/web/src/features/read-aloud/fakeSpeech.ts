import type { SpeechLike, UtteranceLike, VoiceLike } from './voices';

/** A fake speechSynthesis for tests: records what was spoken. */
export function fakeSpeech(voices: VoiceLike[]) {
  const spoken: UtteranceLike[] = [];
  let cancelled = 0;
  const listeners = new Set<() => void>();
  let current = voices;
  const synth: SpeechLike = {
    getVoices: () => current,
    speak: (u) => void spoken.push(u),
    cancel: () => void (cancelled += 1),
    addEventListener: (_type, fn) => void listeners.add(fn),
    removeEventListener: (_type, fn) => void listeners.delete(fn),
  };
  return {
    synth,
    spoken,
    cancelled: () => cancelled,
    /** Voices often arrive late: change them and fire voiceschanged. */
    setVoices(next: VoiceLike[]) {
      current = next;
      listeners.forEach((fn) => fn());
    },
  };
}

export const makeUtterance = (text: string): UtteranceLike => ({
  text,
  lang: '',
  rate: 1,
  voice: null,
});
