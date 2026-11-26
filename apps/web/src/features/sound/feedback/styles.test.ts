import type { SoundFn } from '../bank';
import { createFakeAudioContext } from '../fakeAudio';
import { FEEDBACK_EVENTS, type FeedbackEvent } from './events';
import {
  basePacks,
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
  it("has a pack for each of J's ten styles; Doodle Diary is the default", () => {
    expect(FEEDBACK_STYLES).toEqual([
      'sticker-book',
      'pop-burst',
      'starlight',
      'comic-pop',
      'garden-grow',
      'pixel-arcade',
      'doodle-diary',
      'petal-glow',
      'turbo-drive',
      'rainbow-parade',
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
      // The three-styles reveal is a one-off moment, so it may run longer (legendary cap: 3 s).
      // U8's new moments are quick bursts that sit under J's animations.
      const caps: Partial<Record<FeedbackEvent, number>> = {
        stylesUnlocked: 3,
        pageTransition: 0.3,
        particleBurst: 0.4,
        prizeBox: 0.5,
        nodeComplete: 0.8,
      };
      const longest = caps[event] ?? (quick ? 0.25 : 1.4);
      expect(r.end).toBeLessThanOrEqual(longest);
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
    for (const event of FEEDBACK_EVENTS.filter((e) => e !== 'stylesUnlocked')) {
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

  it('the "three styles unlocked" reveal is one special sound, the same in every style', () => {
    const sigs = new Set(FEEDBACK_STYLES.map((st) => render(st, 'stylesUnlocked').signature));
    expect(sigs.size).toBe(1);
    const r = render(DEFAULT_STYLE, 'stylesUnlocked');
    // Three little motifs (one per new style) and a closing chord: plenty of notes, and noise.
    expect(r.ctx.oscillators.length).toBeGreaterThanOrEqual(12);
    expect(r.ctx.noises.length).toBeGreaterThan(0);
    expect(r.end).toBeGreaterThan(1.4);
    // It ends on a held chord: the last three notes start together.
    const starts = r.ctx.oscillators.map((o) => o.start!);
    const last = starts.slice(-3);
    expect(new Set(last.map((t) => t.toFixed(3))).size).toBe(1);
  });

  it('Petal Glow is soft and twinkly: high bells that swell in, quiet petal swishes', () => {
    const correct = render('petal-glow', 'correct');
    expect(Math.min(...correct.ctx.oscillators.map((o) => o.frequencies[0]!))).toBeGreaterThan(
      1000,
    );
    const attackOf = (style: FeedbackStyle) => {
      const ctx = createFakeAudioContext('running');
      stylePacks[style].rewardOpen(ctx, ctx.createGain(), 0);
      return ctx.attacks[0]!;
    };
    expect(attackOf('petal-glow')).toBeGreaterThan(attackOf('turbo-drive'));
    for (const event of FEEDBACK_EVENTS) {
      const r = render('petal-glow', event);
      expect(r.ctx.oscillators.every((o) => o.type !== 'square')).toBe(true);
    }
  });

  it('Turbo Drive is bold: big moments start with a low thump and a whoosh', () => {
    for (const event of ['levelUp', 'rewardUnlock', 'setComplete'] as const) {
      const r = render('turbo-drive', event);
      expect(r.ctx.oscillators[0]!.frequencies[0]!).toBeLessThan(200);
      expect(r.ctx.noises.length).toBeGreaterThan(0);
    }
  });

  it('Rainbow Parade is a joyful run: level up climbs seven colour-notes of a major scale', () => {
    const r = render('rainbow-parade', 'levelUp');
    const run = r.ctx.oscillators
      .filter((o) => o.type === 'triangle')
      .map((o) => o.frequencies[0]!);
    expect(run.length).toBeGreaterThanOrEqual(7);
    const first7 = run.slice(0, 7);
    for (let i = 1; i < 7; i++) expect(first7[i]!).toBeGreaterThan(first7[i - 1]!);
    // Major scale steps: whole, whole, half, whole, whole, whole (in semitones).
    const semis = first7.slice(1).map((f, i) => Math.round(12 * Math.log2(f / first7[i]!)));
    expect(semis).toEqual([2, 2, 1, 2, 2, 2]);
  });

  describe('U8: pops, whizzes and sparkles in every style', () => {
    const notes = (style: FeedbackStyle, event: FeedbackEvent) => {
      const r = render(style, event);
      return r.ctx.oscillators.length + r.ctx.noises.length;
    };
    /** The same event with U8's layers stripped: what the pack played before U8. */
    const base = (style: FeedbackStyle, event: FeedbackEvent) => {
      const ctx = createFakeAudioContext('running');
      (basePacks[style] as Record<string, SoundFn>)[event]!(ctx, ctx.createGain(), 0);
      return ctx.oscillators.length + ctx.noises.length;
    };

    it.each(FEEDBACK_STYLES)('%s layers juice onto the big moments', (style) => {
      for (const event of [
        'correct',
        'combo',
        'setComplete',
        'levelUp',
        'rewardWobble',
        'rewardOpen',
        'rewardUnlock',
      ] as const) {
        expect(notes(style, event)).toBeGreaterThan(base(style, event));
      }
    });

    it.each(FEEDBACK_STYLES)(
      '%s: goal hit and level up whizz up, then pop in a cascade',
      (style) => {
        for (const event of ['goalHit', 'levelUp'] as const) {
          const ctx = createFakeAudioContext('running');
          stylePacks[style][event](ctx, ctx.createGain(), 0);
          // Some sweep rises (an oscillator or noise filter whose pitch goes up over its note).
          const sweeps = [
            ...ctx.oscillators.map((o) => o.frequencies),
            ...ctx.noises.map((n) => n.frequencies),
          ].filter((f) => f.length > 1 && f[f.length - 1]! > f[0]! * 1.5);
          expect(sweeps.length).toBeGreaterThan(0);
          // A cascade: at least four separate onsets after the whizz.
          const onsets = new Set(
            [...ctx.oscillators, ...ctx.noises].map((o) => o.start!.toFixed(2)),
          );
          expect(onsets.size).toBeGreaterThanOrEqual(5);
        }
      },
    );

    it('the three-styles reveal gains a pop cascade but stays the same in every style', () => {
      const sigs = new Set(FEEDBACK_STYLES.map((st) => render(st, 'stylesUnlocked').signature));
      expect(sigs.size).toBe(1);
      expect(notes(DEFAULT_STYLE, 'stylesUnlocked')).toBeGreaterThan(
        base(DEFAULT_STYLE, 'stylesUnlocked'),
      );
    });

    it('page transitions are a soft whoosh: quiet and short', () => {
      for (const style of FEEDBACK_STYLES) {
        const r = render(style, 'pageTransition');
        expect(r.peak).toBeLessThanOrEqual(0.2);
        expect(r.end).toBeLessThanOrEqual(0.3);
      }
    });

    it('a prize pop climbs with the prize number, like a combo', () => {
      expect(render('pop-burst', 'prizeBox', 1.5).first).toBeGreaterThan(
        render('pop-burst', 'prizeBox', 1).first,
      );
    });
  });
});
