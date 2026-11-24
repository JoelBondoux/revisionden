import { createSoundEngine, VOLUME_LEVELS } from './engine';
import { createFakeAudioContext, type FakeAudioContext } from './fakeAudio';
import { DEFAULT_SOUND_SETTINGS, type SoundSettings } from './settings';

function setup(settings: Partial<SoundSettings> = {}, hidden = false) {
  const contexts: FakeAudioContext[] = [];
  const session = { type: 'auto' };
  let current: SoundSettings = { ...DEFAULT_SOUND_SETTINGS, ...settings };
  let isHidden = hidden;
  const engine = createSoundEngine({
    createContext: () => {
      const ctx = createFakeAudioContext();
      contexts.push(ctx);
      return ctx;
    },
    settings: () => current,
    isHidden: () => isHidden,
    audioSession: session,
  });
  return {
    engine,
    contexts,
    session,
    change: (s: Partial<SoundSettings>) => (current = { ...current, ...s }),
    hide: (h: boolean) => (isHidden = h),
    oscillators: () => contexts.flatMap((c) => c.oscillators).length,
  };
}

describe('sound engine', () => {
  it('plays nothing and makes no audio before the first interaction', () => {
    const { engine, contexts } = setup();
    expect(engine.play('correct')).toBe(false);
    expect(contexts).toHaveLength(0);
  });

  it('makes one audio context after the first interaction, resumes it and reuses it', () => {
    const { engine, contexts } = setup();
    engine.unlock();
    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.resumeCalls).toBe(1);
    expect(engine.play('correct')).toBe(true);
    expect(engine.play('wrong')).toBe(true);
    engine.unlock();
    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.oscillators.length).toBeGreaterThan(0);
  });

  it('resumes a suspended context on demand when a sound plays', () => {
    const { engine, contexts } = setup();
    engine.unlock();
    void contexts[0]!.suspend();
    engine.play('correct');
    expect(contexts[0]!.resumeCalls).toBe(2);
  });

  it('follows the silent switch on iPhone and iPad (ambient audio session)', () => {
    const { engine, session } = setup();
    engine.unlock();
    expect(session.type).toBe('ambient');
  });

  it('respects mute: no sound and no audio context while sound is off', () => {
    const { engine, contexts, change, oscillators } = setup({ enabled: false });
    engine.unlock();
    expect(engine.play('correct')).toBe(false);
    expect(contexts).toHaveLength(0);
    change({ enabled: true });
    expect(engine.play('correct')).toBe(true);
    expect(oscillators()).toBeGreaterThan(0);
  });

  it('sets the master volume from the volume setting', () => {
    const { engine, contexts, change } = setup({ volume: 'low' });
    engine.unlock();
    engine.play('correct');
    const master = contexts[0]!.gains[0]!;
    expect(master.value).toBe(VOLUME_LEVELS.low);
    change({ volume: 'high' });
    engine.play('correct');
    expect(master.value).toBe(VOLUME_LEVELS.high);
    expect(VOLUME_LEVELS.low).toBeLessThan(VOLUME_LEVELS.medium);
    expect(VOLUME_LEVELS.medium).toBeLessThan(VOLUME_LEVELS.high);
  });

  it('plays tap sounds only when tap sounds are switched on', () => {
    const { engine, change } = setup();
    engine.unlock();
    expect(engine.play('tap')).toBe(false);
    change({ taps: true });
    expect(engine.play('tap')).toBe(true);
  });

  it('applies the Test mode rule', () => {
    const { engine } = setup();
    engine.unlock();
    expect(engine.play('correct', { mode: 'test' })).toBe(false);
    expect(engine.play('reveal', { mode: 'test' })).toBe(true);
  });

  it('never plays while the app is in the background, and suspends when hidden', () => {
    const { engine, contexts, hide } = setup();
    engine.unlock();
    hide(true);
    expect(engine.play('correct')).toBe(false);
    engine.suspend();
    expect(contexts[0]!.suspendCalls).toBe(1);
  });

  it('copes with a browser that has no Web Audio or throws', () => {
    const none = createSoundEngine({
      createContext: () => null,
      settings: () => DEFAULT_SOUND_SETTINGS,
      isHidden: () => false,
    });
    none.unlock();
    expect(none.play('correct')).toBe(false);
    expect(() => none.suspend()).not.toThrow();

    const throwing = createSoundEngine({
      createContext: () => {
        throw new Error('no audio');
      },
      settings: () => DEFAULT_SOUND_SETTINGS,
      isHidden: () => false,
      audioSession: Object.freeze({ type: 'auto' }),
    });
    expect(() => throwing.unlock()).not.toThrow();
    expect(throwing.play('correct')).toBe(false);
  });
});
