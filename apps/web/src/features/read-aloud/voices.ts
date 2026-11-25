/** The parts of the Web Speech API read aloud uses, so tests can pass a fake. */
export interface VoiceLike {
  name: string;
  lang: string;
  /** True when the voice runs on the device; false when the text goes to an online service. */
  localService: boolean;
}

export interface UtteranceLike {
  text: string;
  lang: string;
  rate: number;
  voice: VoiceLike | null;
}

export interface SpeechLike {
  getVoices(): VoiceLike[];
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  addEventListener(type: 'voiceschanged', listener: () => void): void;
  removeEventListener(type: 'voiceschanged', listener: () => void): void;
}

export interface ChosenVoice {
  voice: VoiceLike;
  onDevice: boolean;
}

const lang = (v: VoiceLike) => v.lang.replace('_', '-').toLowerCase();

/**
 * Picks the voice for read aloud: British English on the device first, then any English voice on
 * the device, then an online English voice (onDevice false: the setting then starts off).
 */
export function chooseVoice(voices: readonly VoiceLike[]): ChosenVoice | null {
  const english = voices.filter((v) => lang(v).startsWith('en'));
  const ranked = [
    english.find((v) => v.localService && lang(v) === 'en-gb'),
    english.find((v) => v.localService),
    english.find((v) => lang(v) === 'en-gb'),
    english[0],
  ];
  const voice = ranked.find((v) => v !== undefined);
  return voice ? { voice, onDevice: voice.localService } : null;
}
