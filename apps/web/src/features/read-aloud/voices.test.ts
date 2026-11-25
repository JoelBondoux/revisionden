import { chooseVoice, type VoiceLike } from './voices';

const voice = (name: string, lang: string, localService: boolean): VoiceLike => ({
  name,
  lang,
  localService,
});

describe('choosing a voice', () => {
  it('prefers a British English voice that runs on the device', () => {
    const voices = [
      voice('Online UK', 'en-GB', false),
      voice('Device US', 'en-US', true),
      voice('Device UK', 'en-GB', true),
    ];
    expect(chooseVoice(voices)).toEqual({ voice: voices[2], onDevice: true });
  });

  it('uses another on-device English voice before any online one', () => {
    const voices = [voice('Online UK', 'en-GB', false), voice('Device US', 'en_US', true)];
    expect(chooseVoice(voices)).toEqual({ voice: voices[1], onDevice: true });
  });

  it('falls back to an online English voice and says so', () => {
    const voices = [voice('Device FR', 'fr-FR', true), voice('Online UK', 'en-GB', false)];
    expect(chooseVoice(voices)).toEqual({ voice: voices[1], onDevice: false });
  });

  it('finds nothing when there are no English voices', () => {
    expect(chooseVoice([voice('Device FR', 'fr-FR', true)])).toBeNull();
    expect(chooseVoice([])).toBeNull();
  });
});
