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

describe('sound engine: reward sounds', () => {
  function rewardSetup(settings: Partial<SoundSettings> = {}, randoms: number[] = [0]) {
    const contexts: FakeAudioContext[] = [];
    let i = 0;
    const engine = createSoundEngine({
      createContext: () => {
        const ctx = createFakeAudioContext();
        contexts.push(ctx);
        return ctx;
      },
      settings: () => ({ ...DEFAULT_SOUND_SETTINGS, ...settings }),
      isHidden: () => false,
      random: () => randoms[i++ % randoms.length]!,
    });
    engine.unlock();
    return { engine, ctx: () => contexts[0]! };
  }

  it('plays only the biggest of several rewards, once', () => {
    const { engine } = rewardSetup();
    const played = engine.playReward([
      { id: 'level-9', rarity: 'common' },
      { id: 'streak-100', rarity: 'epic' },
    ]);
    expect(played).toMatchObject({ tier: 'epic', step: 3 });
    expect(engine.playReward([])).toBeNull();
  });

  it('never plays the same variation twice in a row, with the same random numbers', () => {
    const { engine } = rewardSetup({}, [0]);
    const variations = Array.from(
      { length: 6 },
      () => engine.playReward([{ id: 'streak-7', rarity: 'common' }])!.variation,
    );
    for (let i = 1; i < variations.length; i++) expect(variations[i]).not.toBe(variations[i - 1]);
  });

  it('respects mute, volume and the Test mode rule', () => {
    const muted = rewardSetup({ enabled: false });
    expect(muted.engine.playReward([{ id: 'streak-7', rarity: 'common' }])).toBeNull();

    const quiet = rewardSetup({ volume: 'low' });
    quiet.engine.playReward([{ id: 'streak-7', rarity: 'common' }]);
    expect(quiet.ctx().gains[0]!.value).toBe(VOLUME_LEVELS.low);

    const test = rewardSetup();
    expect(
      test.engine.playReward([{ id: 'streak-7', rarity: 'common' }], { mode: 'test' }),
    ).toBeNull();
    expect(test.engine.play('rewardUnlocked', { mode: 'test' })).toBe(false);
    expect(test.engine.play('levelUp', { mode: 'test' })).toBe(false);
  });

  it("waits for the lesson's own result sound to finish", () => {
    const { engine, ctx } = rewardSetup();
    engine.play('correct');
    const resultEnd = Math.max(...ctx().oscillators.map((o) => o.stop!));
    const before = ctx().oscillators.length;
    engine.playReward([{ id: 'streak-7', rarity: 'common' }]);
    const rewardStart = Math.min(
      ...ctx()
        .oscillators.slice(before)
        .map((o) => o.start!),
    );
    expect(rewardStart).toBeGreaterThanOrEqual(resultEnd);
  });

  it('lets a tap skip a legendary sound, but not smaller ones', () => {
    const { engine, ctx } = rewardSetup();
    engine.playReward([{ id: 'streak-30', rarity: 'rare' }]);
    expect(engine.skip()).toBe(false);
    const before = ctx().gains.length;
    engine.playReward([{ id: 'streak-1000', rarity: 'legendary' }]);
    // The first gain made for a reward sound is its own volume, which a skip fades to silence.
    const voice = ctx().gains[before]!;
    expect(engine.skip()).toBe(true);
    expect(voice.peaks.at(-1)).toBe(0);
    expect(engine.skip()).toBe(false);
  });

  it('plays a sample of each tier for the Settings buttons', () => {
    const { engine } = rewardSetup();
    expect(engine.sampleReward('legendary')).toMatchObject({ tier: 'legendary' });
    expect(engine.sampleReward('common')).toMatchObject({ tier: 'common' });
  });
});
