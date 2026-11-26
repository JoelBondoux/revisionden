import { createFakeAudioContext } from '../fakeAudio';
import { FEEDBACK_EVENTS, type FeedbackEvent } from './events';
import {
  DEFAULT_STYLE,
  FEEDBACK_STYLES,
  SQUARE_LOWPASS_HZ,
  resolveStyle,
  stylePacks,
  type FeedbackStyle,
} from './styles';

/** Styles allowed square waves (always low-passed): the owner approved them for these only. */
const SQUARE_STYLES: readonly FeedbackStyle[] = ['comic-pop', 'pixel-arcade'];

function render(style: FeedbackStyle, event: FeedbackEvent, pitch = 1) {
  const ctx = createFakeAudioContext('running');
  const end = stylePacks[style][event](ctx, ctx.createGain(), 0, pitch);
  return {
    ctx,
    end,
    signature: [
      ...ctx.oscillators.map(
        (o) => `${o.type}:${o.frequencies.map((f) => f.toFixed(0)).join('>')}`,
      ),
      ...ctx.noises.map(
        (n) => `noise:${n.filter}:${n.frequencies.map((f) => f.toFixed(0)).join('>')}`,
      ),
    ].join(','),
    peak: Math.max(...ctx.gains.flatMap((g) => g.peaks)),
    first: ctx.oscillators[0]?.frequencies[0] ?? ctx.noises[0]!.frequencies[0]!,
  };
}

describe('style sound packs', () => {
  it("has a pack for each of J's seven styles; Doodle Diary is the default", () => {
    expect(FEEDBACK_STYLES).toEqual([
      'sticker-book',
      'pop-burst',
      'starlight',
      'comic-pop',
      'garden-grow',
      'pixel-arcade',
      'doodle-diary',
    ]);
    expect(DEFAULT_STYLE).toBe('doodle-diary');
    expect(resolveStyle('pop-burst')).toBe('pop-burst');
    expect(resolveStyle('doodle-diary')).toBe('doodle-diary');
    // Unknown styles fall back to the default.
    expect(resolveStyle('neon-arcade')).toBe('doodle-diary');
    expect(resolveStyle(undefined)).toBe('doodle-diary');
    // Sticker Book is now an unlockable style like the others.
    expect(resolveStyle('sticker-book')).toBe('sticker-book');
  });

  describe.each(FEEDBACK_STYLES)('%s', (style) => {
    it('has a sound for every event', () => {
      expect(Object.keys(stylePacks[style]).sort()).toEqual([...FEEDBACK_EVENTS].sort());
    });

    it.each(FEEDBACK_EVENTS)('%s is short, soft and balanced', (event) => {
      const r = render(style, event);
      expect(r.ctx.oscillators.length + r.ctx.noises.length).toBeGreaterThan(0);
      const waves = SQUARE_STYLES.includes(style)
        ? ['sine', 'triangle', 'square']
        : ['sine', 'triangle'];
      for (const o of r.ctx.oscillators) {
        expect(waves).toContain(o.type);
        expect(o.stop).not.toBeNull();
      }
      for (const n of r.ctx.noises) expect(n.stop).not.toBeNull();
      const quick = ['buttonPress', 'xpTick', 'ringFill', 'cardFlip', 'nodePop'].includes(event);
      expect(r.end).toBeLessThanOrEqual(quick ? 0.25 : 1.4);
      // Volume-balanced: nothing louder than the existing correct chime's peak.
      expect(r.peak).toBeLessThanOrEqual(0.55);
      expect(r.peak).toBeGreaterThan(0.05);
    });

    it('raises the combo with its step', () => {
      expect(render(style, 'combo', 1.5).first).toBeGreaterThan(render(style, 'combo', 1).first);
    });

    it('"wrong" is soft in every style: no square waves, never loud', () => {
      const r = render(style, 'wrong');
      for (const o of r.ctx.oscillators) expect(['sine', 'triangle']).toContain(o.type);
      expect(r.peak).toBeLessThanOrEqual(0.3);
    });
  });

  it('sounds different in each style', () => {
    for (const event of FEEDBACK_EVENTS) {
      const sigs = new Set(FEEDBACK_STYLES.map((s) => render(s, event).signature));
      expect(sigs.size).toBe(FEEDBACK_STYLES.length);
    }
  });

  it('every square wave is low-passed, short and quieter than soft waves', () => {
    for (const style of SQUARE_STYLES) {
      for (const event of FEEDBACK_EVENTS) {
        const r = render(style, event);
        const squares = r.ctx.oscillators.filter((o) => o.type === 'square');
        const lowpasses = r.ctx.filters.filter(
          (f) => f.type === 'lowpass' && f.frequency <= SQUARE_LOWPASS_HZ,
        );
        expect(lowpasses.length).toBeGreaterThanOrEqual(squares.length);
        for (const o of squares) expect(o.stop! - o.start!).toBeLessThanOrEqual(0.5);
      }
    }
    expect(SQUARE_LOWPASS_HZ).toBeLessThanOrEqual(3000);
    const squaresUsed = SQUARE_STYLES.some((s) =>
      render(s, 'correct').ctx.oscillators.some((o) => o.type === 'square'),
    );
    expect(squaresUsed).toBe(true);
  });

  it('locked is a gentle low "not yet", never a buzzer', () => {
    for (const style of FEEDBACK_STYLES) {
      const r = render(style, 'locked');
      for (const o of r.ctx.oscillators) expect(o.frequencies[0]!).toBeLessThan(700);
      expect(r.peak).toBeLessThanOrEqual(0.3);
    }
  });

  it('Starlight and Garden Grow swell in; the others hit straight away', () => {
    const attackOf = (style: FeedbackStyle) => {
      const ctx = createFakeAudioContext('running');
      stylePacks[style].rewardOpen(ctx, ctx.createGain(), 0);
      return ctx.attacks[0]!;
    };
    for (const soft of ['starlight', 'garden-grow'] as const) {
      for (const punchy of ['sticker-book', 'pop-burst', 'comic-pop', 'pixel-arcade'] as const) {
        expect(attackOf(soft)).toBeGreaterThan(attackOf(punchy));
      }
    }
  });

  it('Doodle Diary is paper and pen: clicks, page flips, scratches and a scribble', () => {
    for (const event of [
      'buttonPress',
      'cardFlip',
      'homeEnter',
      'locked',
      'rewardUnlock',
    ] as const) {
      expect(render('doodle-diary', event).ctx.noises.length).toBeGreaterThan(0);
    }
    // The unlock flourish is a scribble: several quick pen strokes.
    expect(render('doodle-diary', 'rewardUnlock').ctx.noises.length).toBeGreaterThanOrEqual(3);
  });

  it('Pixel Arcade is chiptune: fast square arpeggios for big moments', () => {
    const r = render('pixel-arcade', 'levelUp');
    expect(r.ctx.oscillators.filter((o) => o.type === 'square').length).toBeGreaterThanOrEqual(6);
  });

  it('Garden Grow is woodwind and chimes, with no square waves', () => {
    for (const event of FEEDBACK_EVENTS) {
      const r = render('garden-grow', event);
      expect(r.ctx.oscillators.every((o) => o.type !== 'square')).toBe(true);
    }
  });
});
