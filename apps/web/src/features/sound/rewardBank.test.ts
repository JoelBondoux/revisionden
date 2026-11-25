import { createFakeAudioContext } from './fakeAudio';
import { rewardSound, TIER_MAX_SECONDS } from './rewardBank';
import { REWARD_TIERS, VARIATIONS_PER_TIER, type RewardSoundSpec } from './rewardSounds';

const spec = (over: Partial<RewardSoundSpec> = {}): RewardSoundSpec => ({
  tier: 'common',
  step: 0,
  voice: 'standard',
  fanfare: null,
  ...over,
});

function render(s: RewardSoundSpec, variation = 0) {
  const ctx = createFakeAudioContext('running');
  const end = rewardSound(s, variation)(ctx, ctx.createGain(), 0);
  const freqs = ctx.oscillators.map((o) => o.frequencies[0]!);
  return {
    ctx,
    end,
    count: ctx.oscillators.length,
    top: Math.max(...freqs),
    signature: ctx.oscillators.map((o) => `${o.type}:${o.frequencies[0]!.toFixed(1)}`).join(','),
    lastStop: Math.max(...ctx.oscillators.map((o) => o.stop!)),
  };
}

describe('reward sounds', () => {
  it.each(REWARD_TIERS)(
    '%s: every variation is soft, stops by itself and fits its length',
    (tier) => {
      for (let v = 0; v < VARIATIONS_PER_TIER; v++) {
        const r = render(spec({ tier }), v);
        for (const o of r.ctx.oscillators) expect(['sine', 'triangle']).toContain(o.type);
        expect(r.lastStop).toBeLessThanOrEqual(TIER_MAX_SECONDS[tier]);
        expect(r.end).toBeGreaterThan(0);
        expect(r.end).toBeLessThanOrEqual(TIER_MAX_SECONDS[tier]);
      }
    },
  );

  it('keeps legendary to 3 seconds at most, finishers and top ladder steps included', () => {
    expect(TIER_MAX_SECONDS.legendary).toBeLessThanOrEqual(3);
    for (const fanfare of ['gcse', 'aLevel'] as const) {
      expect(render(spec({ tier: 'legendary', fanfare, step: 8 })).lastStop).toBeLessThanOrEqual(3);
    }
  });

  it('bigger tiers last longer', () => {
    const lengths = REWARD_TIERS.map((tier) => render(spec({ tier })).end);
    expect([...lengths].sort((a, b) => a - b)).toEqual(lengths);
    expect(new Set(lengths).size).toBe(4);
  });

  it('has really different variations in each tier', () => {
    for (const tier of REWARD_TIERS) {
      const sigs = new Set(
        Array.from({ length: VARIATIONS_PER_TIER }, (_, v) => render(spec({ tier }), v).signature),
      );
      expect(sigs.size).toBe(VARIATIONS_PER_TIER);
    }
  });

  it('each ladder step sounds higher and fuller than the one before', () => {
    let previous = render(spec({ tier: 'rare', step: 0 }));
    for (let step = 1; step <= 8; step++) {
      const now = render(spec({ tier: 'rare', step }));
      expect(now.top).toBeGreaterThan(previous.top);
      expect(now.count).toBeGreaterThanOrEqual(previous.count);
      previous = now;
    }
    expect(previous.count).toBeGreaterThan(render(spec({ tier: 'rare', step: 0 })).count);
  });

  it('gives each year chapter its own voice', () => {
    const voices = [
      'standard',
      'chapter1',
      'chapter2',
      'chapter3',
      'chapter4',
      'chapter5',
    ] as const;
    const sigs = new Set(voices.map((voice) => render(spec({ tier: 'epic', voice })).signature));
    expect(sigs.size).toBe(voices.length);
  });

  it('gives the GCSE and A-Level finishers their own fanfares, unlike any variation', () => {
    const others = Array.from(
      { length: VARIATIONS_PER_TIER },
      (_, v) => render(spec({ tier: 'legendary' }), v).signature,
    );
    const gcse = render(spec({ tier: 'legendary', fanfare: 'gcse' })).signature;
    const aLevel = render(spec({ tier: 'legendary', fanfare: 'aLevel' })).signature;
    expect(gcse).not.toBe(aLevel);
    expect(others).not.toContain(gcse);
    expect(others).not.toContain(aLevel);
  });

  it('legendary ends on a low hit under its harmony', () => {
    const r = render(spec({ tier: 'legendary' }));
    expect(Math.min(...r.ctx.oscillators.map((o) => o.frequencies[0]!))).toBeLessThan(110);
  });
});
