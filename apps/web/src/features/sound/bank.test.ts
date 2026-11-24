import { soundBank } from './bank';
import { SOUND_EVENTS } from './events';
import { createFakeAudioContext } from './fakeAudio';

describe('sound bank', () => {
  it('has one sound for every event', () => {
    expect(Object.keys(soundBank).sort()).toEqual([...SOUND_EVENTS].sort());
  });

  it.each(SOUND_EVENTS)('%s is short, soft and stops itself', (event) => {
    const ctx = createFakeAudioContext('running');
    const out = ctx.createGain();
    soundBank[event](ctx, out, 0);
    expect(ctx.oscillators.length).toBeGreaterThan(0);
    for (const osc of ctx.oscillators) {
      // Soft, musical waves only: no harsh square or sawtooth buzz.
      expect(['sine', 'triangle']).toContain(osc.type);
      expect(osc.start).not.toBeNull();
      expect(osc.stop).not.toBeNull();
      expect(osc.stop!).toBeLessThanOrEqual(event === 'tap' ? 0.5 : 1.6);
    }
  });

  it('wrong is gentle: low notes, quieter than correct', () => {
    const loudest = (event: 'correct' | 'wrong') => {
      const ctx = createFakeAudioContext('running');
      soundBank[event](ctx, ctx.createGain(), 0);
      const top = Math.max(...ctx.oscillators.flatMap((o) => o.frequencies));
      const peak = Math.max(...ctx.gains.flatMap((g) => g.peaks));
      return { top, peak };
    };
    const wrong = loudest('wrong');
    const correct = loudest('correct');
    expect(wrong.top).toBeLessThan(500);
    expect(wrong.peak).toBeLessThan(correct.peak);
  });

  it('starts at the time it is given', () => {
    const ctx = createFakeAudioContext('running');
    soundBank.correct(ctx, ctx.createGain(), 2);
    expect(Math.min(...ctx.oscillators.map((o) => o.start!))).toBeGreaterThanOrEqual(2);
  });
});
