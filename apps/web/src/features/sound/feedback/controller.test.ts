import { createSoundEngine } from '../engine';
import { createFakeAudioContext, type FakeAudioContext } from '../fakeAudio';
import { DEFAULT_SOUND_SETTINGS, type SoundSettings } from '../settings';
import { createFeedback } from './controller';
import { DEFAULT_STYLE } from './styles';

function setup(
  settings: Partial<SoundSettings> = {},
  { supported = true, reduced = false }: { supported?: boolean; reduced?: boolean } = {},
) {
  let now = 0;
  let current: SoundSettings = { ...DEFAULT_SOUND_SETTINGS, ...settings };
  let reducedMotion = reduced;
  const contexts: FakeAudioContext[] = [];
  const engine = createSoundEngine({
    createContext: () => {
      const ctx = createFakeAudioContext();
      contexts.push(ctx);
      return ctx;
    },
    settings: () => current,
    isHidden: () => false,
  });
  const vibrations: number[][] = [];
  const feedback = createFeedback({
    engine,
    settings: () => current,
    haptics: { supported, vibrate: (p) => void vibrations.push(p) },
    now: () => now,
    reducedMotion: () => reducedMotion,
  });
  return {
    engine,
    feedback,
    vibrations,
    sounds: () => contexts.flatMap((c) => c.oscillators).length,
    ctx: () => contexts[0]!,
    tick: (ms: number) => (now += ms),
    change: (s: Partial<SoundSettings>) => (current = { ...current, ...s }),
    setReduced: (r: boolean) => (reducedMotion = r),
  };
}

describe('feedback: sound and vibration for every animation', () => {
  it('does nothing before the first tap', () => {
    const t = setup();
    expect(t.feedback.emit('correct')).toEqual({ sound: false, haptic: false });
    expect(t.vibrations).toHaveLength(0);
  });

  it('plays the style sound and vibrates once unlocked', () => {
    const t = setup();
    t.engine.unlock();
    expect(t.feedback.emit('correct')).toEqual({ sound: true, haptic: true });
    expect(t.sounds()).toBeGreaterThan(0);
    expect(t.vibrations).toHaveLength(1);
  });

  it('switching style switches the sounds and the vibration', () => {
    const t = setup();
    t.engine.unlock();
    t.feedback.emit('correct');
    const sticker = t.ctx().oscillators.map((o) => o.frequencies[0]);
    const stickerBuzz = t.vibrations[0];
    t.feedback.setStyle('starlight');
    expect(t.feedback.style()).toBe('starlight');
    t.tick(1000);
    const before = t.ctx().oscillators.length;
    t.feedback.emit('correct');
    expect(
      t
        .ctx()
        .oscillators.slice(before)
        .map((o) => o.frequencies[0]),
    ).not.toEqual(sticker);
    expect(t.vibrations[1]).not.toEqual(stickerBuzz);
    t.feedback.setStyle('a-style-not-built-yet');
    expect(t.feedback.style()).toBe(DEFAULT_STYLE);
  });

  it('mute stops sound; the Vibration switch stops vibration; each on its own', () => {
    const t = setup({ enabled: false });
    t.engine.unlock();
    expect(t.feedback.emit('correct')).toEqual({ sound: false, haptic: true });
    t.change({ enabled: true, vibration: false });
    t.tick(1000);
    expect(t.feedback.emit('correct')).toEqual({ sound: true, haptic: false });
  });

  it('button presses only make a sound when tap sounds are on', () => {
    const t = setup();
    t.engine.unlock();
    expect(t.feedback.emit('buttonPress')).toEqual({ sound: false, haptic: true });
    t.change({ taps: true });
    t.tick(1000);
    expect(t.feedback.emit('buttonPress').sound).toBe(true);
  });

  it('throttles fast ticks so they never stack into noise', () => {
    const t = setup();
    t.engine.unlock();
    let played = 0;
    for (let i = 0; i < 20; i++) {
      if (t.feedback.emit('xpTick').sound) played++;
      t.tick(10);
    }
    // 20 ticks over 200 ms: at most one every 70 ms.
    expect(played).toBeLessThanOrEqual(3);
    expect(played).toBeGreaterThan(0);
  });

  it('throttles map nodes popping in a burst, with no buzzing', () => {
    const t = setup();
    t.engine.unlock();
    let played = 0;
    for (let i = 0; i < 12; i++) {
      if (t.feedback.emit('nodePop').sound) played++;
      t.tick(20);
    }
    // 12 pops over 240 ms: at most one every 70 ms.
    expect(played).toBeLessThanOrEqual(4);
    expect(played).toBeGreaterThan(1);
    expect(t.vibrations).toHaveLength(0);
  });

  it('a locked tap gives a gentle sound and a short buzz, even in Test mode', () => {
    const t = setup();
    t.engine.unlock();
    expect(t.feedback.emit('locked', { mode: 'test' })).toEqual({ sound: true, haptic: true });
  });

  it('caps sounds per second across all events', () => {
    const t = setup();
    t.engine.unlock();
    const events = ['correct', 'cardFlip', 'rewardWobble', 'rewardOpen', 'ringFill'] as const;
    let played = 0;
    for (let i = 0; i < 40; i++) {
      if (t.feedback.emit(events[i % events.length]!).sound) played++;
      t.tick(25);
    }
    // 40 events in one second: capped at 10.
    expect(played).toBeLessThanOrEqual(10);
  });

  it('caps vibration: a gap between buzzes and at most 4 a second', () => {
    const t = setup();
    t.engine.unlock();
    for (let i = 0; i < 20; i++) {
      t.feedback.emit('cardFlip');
      t.tick(50);
    }
    expect(t.vibrations.length).toBeLessThanOrEqual(4);
    expect(t.vibrations.length).toBeGreaterThan(1);
  });

  it('with reduced motion keeps the sound but softer, and the buzz shorter', () => {
    const loud = setup();
    loud.engine.unlock();
    loud.feedback.emit('rewardOpen');
    const quiet = setup({}, { reduced: true });
    quiet.engine.unlock();
    quiet.feedback.emit('rewardOpen');
    const voiceGain = (t: ReturnType<typeof setup>) => t.ctx().gains[1]!.value;
    expect(voiceGain(quiet)).toBeLessThan(voiceGain(loud));
    expect(voiceGain(quiet)).toBeGreaterThan(0);
    const total = (p: number[]) => p.reduce((a, b) => a + b, 0);
    expect(total(quiet.vibrations[0]!)).toBeLessThan(total(loud.vibrations[0]!));
  });

  it('keeps the Test mode rule: no right/wrong or reward feedback before submit', () => {
    const t = setup();
    t.engine.unlock();
    expect(t.feedback.emit('correct', { mode: 'test' })).toEqual({ sound: false, haptic: false });
    expect(t.feedback.emit('rewardUnlock', { mode: 'test' }).sound).toBe(false);
    expect(t.feedback.emit('ringFill', { mode: 'test' }).sound).toBe(true);
    t.tick(1000);
    expect(t.feedback.emit('ringFill', { mode: 'timed' }).sound).toBe(false);
  });

  it('copes with a device that cannot vibrate', () => {
    const t = setup({}, { supported: false });
    t.engine.unlock();
    expect(t.feedback.emit('levelUp')).toEqual({ sound: true, haptic: false });
    expect(t.feedback.vibrationSupported).toBe(false);
  });

  it('can vibrate on its own for sounds played elsewhere (reward tiers)', () => {
    const t = setup();
    t.engine.unlock();
    expect(t.feedback.vibrateFor('rewardUnlock')).toBe(true);
    expect(t.vibrations).toHaveLength(1);
    expect(t.sounds()).toBe(0);
  });
});
