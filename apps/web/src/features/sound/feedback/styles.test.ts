import { createFakeAudioContext } from '../fakeAudio';
import { FEEDBACK_EVENTS } from './events';
import { FEEDBACK_STYLES, resolveStyle, stylePacks } from './styles';

function render(
  style: (typeof FEEDBACK_STYLES)[number],
  event: (typeof FEEDBACK_EVENTS)[number],
  pitch = 1,
) {
  const ctx = createFakeAudioContext('running');
  const end = stylePacks[style][event](ctx, ctx.createGain(), 0, pitch);
  return {
    ctx,
    end,
    signature: ctx.oscillators
      .map((o) => `${o.type}:${o.frequencies.map((f) => f.toFixed(0)).join('>')}`)
      .join(','),
    peak: Math.max(...ctx.gains.flatMap((g) => g.peaks)),
    first: ctx.oscillators[0]!.frequencies[0]!,
  };
}

describe('style sound packs', () => {
  it('has Sticker Book (default), Pop Burst and Starlight', () => {
    expect(FEEDBACK_STYLES).toEqual(['sticker-book', 'pop-burst', 'starlight']);
    expect(resolveStyle('pop-burst')).toBe('pop-burst');
    // Styles still to come fall back to the default until they get a pack.
    expect(resolveStyle('neon-arcade')).toBe('sticker-book');
    expect(resolveStyle(undefined)).toBe('sticker-book');
  });

  describe.each(FEEDBACK_STYLES)('%s', (style) => {
    it('has a sound for every event', () => {
      expect(Object.keys(stylePacks[style]).sort()).toEqual([...FEEDBACK_EVENTS].sort());
    });

    it.each(FEEDBACK_EVENTS)('%s is short, soft and balanced', (event) => {
      const r = render(style, event);
      expect(r.ctx.oscillators.length).toBeGreaterThan(0);
      for (const o of r.ctx.oscillators) {
        expect(['sine', 'triangle']).toContain(o.type);
        expect(o.stop).not.toBeNull();
      }
      const quick = ['buttonPress', 'xpTick', 'ringFill', 'cardFlip'].includes(event);
      expect(r.end).toBeLessThanOrEqual(quick ? 0.25 : 1.4);
      // Volume-balanced: nothing louder than the existing correct chime's peak.
      expect(r.peak).toBeLessThanOrEqual(0.55);
      expect(r.peak).toBeGreaterThan(0.05);
    });

    it('raises the combo with its step', () => {
      expect(render(style, 'combo', 1.5).first).toBeGreaterThan(render(style, 'combo', 1).first);
    });
  });

  it('sounds different in each style', () => {
    for (const event of FEEDBACK_EVENTS) {
      const sigs = new Set(FEEDBACK_STYLES.map((s) => render(s, event).signature));
      expect(sigs.size).toBe(FEEDBACK_STYLES.length);
    }
  });

  it('Starlight swells in slowly; Sticker Book and Pop Burst hit straight away', () => {
    const attackOf = (style: (typeof FEEDBACK_STYLES)[number]) => {
      const ctx = createFakeAudioContext('running');
      stylePacks[style].rewardOpen(ctx, ctx.createGain(), 0);
      return ctx.attacks[0]!;
    };
    expect(attackOf('starlight')).toBeGreaterThan(attackOf('sticker-book'));
    expect(attackOf('starlight')).toBeGreaterThan(attackOf('pop-burst'));
  });
});
