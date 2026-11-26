import {
  BURST_CAP,
  FLAVOURS,
  MAX_LIVE_PARTICLES,
  burstFor,
  fitToBudget,
  flavourFor,
  planBurst,
  shapeSvg,
} from './plan';

/** Repeatable "random" numbers for tests. */
function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('particle flavours (J17, from the owner-approved mockup)', () => {
  it('has a flavour for every effect style, including the three still to come', () => {
    for (const id of [
      'doodle-diary',
      'sticker-book',
      'pop-burst',
      'starlight',
      'comic-pop',
      'garden-grow',
      'pixel-arcade',
      'petal-glow',
      'turbo-drive',
      'rainbow-parade',
    ]) {
      expect(FLAVOURS[id], id).toBeDefined();
    }
  });

  it('falls back to Doodle Diary for an unknown style', () => {
    expect(flavourFor('no-such-style')).toBe(FLAVOURS['doodle-diary']);
  });

  it('gives each style its own shapes', () => {
    const shapes = (id: string) => FLAVOURS[id]!.picks.map((p) => p.shape);
    expect(shapes('pop-burst')).toContain('coin');
    expect(shapes('garden-grow')).toEqual(expect.arrayContaining(['petal', 'leaf']));
    expect(shapes('pixel-arcade')).toEqual(['pixel']);
    expect(shapes('turbo-drive')).toEqual(['streak']);
    expect(FLAVOURS['comic-pop']!.words).toContain('POW!');
  });

  it('draws every shape as a small SVG in the given colour', () => {
    for (const flavour of Object.values(FLAVOURS)) {
      for (const pick of flavour.picks) {
        const svg = shapeSvg(pick.shape, pick.colours[0]!);
        expect(svg.startsWith('<svg'), pick.shape).toBe(true);
        expect(svg).toContain(pick.colours[0]!);
      }
    }
  });
});

describe('planBurst', () => {
  it('plans the asked number of particles, flying outwards from the centre', () => {
    const plan = planBurst(100, 100, FLAVOURS['doodle-diary']!, { count: 12 }, seeded());
    expect(plan.particles).toHaveLength(12);
    for (const p of plan.particles) {
      expect(p.frames[0]!.offset).toBe(0);
      expect(p.frames.at(-1)!.offset).toBe(1);
      expect(p.frames.at(-1)!.opacity).toBe(0);
    }
  });

  it('never plans more than the cap in one burst', () => {
    const plan = planBurst(0, 0, FLAVOURS['pop-burst']!, { count: 500 }, seeded());
    expect(plan.particles).toHaveLength(BURST_CAP);
  });

  it('animates only transform and opacity (cheap on a phone)', () => {
    const plan = planBurst(0, 0, FLAVOURS['rainbow-parade']!, { count: 8 }, seeded());
    for (const p of plan.particles) {
      for (const frame of p.frames) {
        expect(Object.keys(frame).sort()).toEqual(['offset', 'opacity', 'transform']);
      }
    }
  });

  it('is repeatable with the same random numbers', () => {
    const a = planBurst(5, 5, FLAVOURS.starlight!, { count: 6 }, seeded(7));
    const b = planBurst(5, 5, FLAVOURS.starlight!, { count: 6 }, seeded(7));
    expect(a).toEqual(b);
  });

  it('keeps durations and sizes inside the style’s ranges', () => {
    const flavour = FLAVOURS['garden-grow']!;
    const plan = planBurst(0, 0, flavour, { count: 20 }, seeded(3));
    for (const p of plan.particles) {
      expect(p.durationMs).toBeGreaterThanOrEqual(flavour.durationMs[0]);
      expect(p.durationMs).toBeLessThanOrEqual(flavour.durationMs[1]);
      expect(p.size).toBeGreaterThanOrEqual(flavour.size[0]);
      expect(p.size).toBeLessThanOrEqual(flavour.size[1]);
    }
  });

  it('flies further with more power', () => {
    const reach = (power: number) => {
      const plan = planBurst(0, 0, FLAVOURS['turbo-drive']!, { count: 8, power }, seeded(5));
      return plan.particles.reduce((sum, p) => {
        const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(p.frames.at(-1)!.transform)!;
        return sum + Math.hypot(Number(m[1]), Number(m[2]));
      }, 0);
    };
    expect(reach(1.5)).toBeGreaterThan(reach(0.5));
  });

  it('shows a comic word only for big bursts or when asked, and only in styles that have them', () => {
    const comic = FLAVOURS['comic-pop']!;
    expect(planBurst(0, 0, comic, { count: 4 }, seeded()).word).toBeNull();
    expect(planBurst(0, 0, comic, { count: 4, word: true }, seeded()).word).toMatch(/!$/);
    expect(planBurst(0, 0, comic, { count: 4, power: 1.4 }, seeded()).word).toMatch(/!$/);
    expect(
      planBurst(0, 0, FLAVOURS.starlight!, { count: 4, word: true }, seeded()).word,
    ).toBeNull();
  });

  it('flashes a ring in the style’s colour that grows with power', () => {
    const small = planBurst(0, 0, FLAVOURS.starlight!, { power: 0.5 }, seeded());
    const big = planBurst(0, 0, FLAVOURS.starlight!, { power: 1.5 }, seeded());
    expect(small.ring.colour).toBe(FLAVOURS.starlight!.ring);
    expect(big.ring.scale).toBeGreaterThan(small.ring.scale);
  });
});

describe('fitToBudget (a cap on particles alive at once)', () => {
  it('lets a burst through while there is room', () => {
    expect(fitToBudget(20, 0)).toBe(20);
  });
  it('trims a burst to the room left', () => {
    expect(fitToBudget(20, MAX_LIVE_PARTICLES - 5)).toBe(5);
  });
  it('drops a burst when the screen is full', () => {
    expect(fitToBudget(20, MAX_LIVE_PARTICLES)).toBe(0);
    expect(fitToBudget(20, MAX_LIVE_PARTICLES + 10)).toBe(0);
  });
});

describe('burstFor (how big each moment’s burst is)', () => {
  it('grows a right answer’s burst with the combo, from 4 in a row', () => {
    const plain = burstFor('correct');
    expect(plain.count).toBe(18);
    expect(burstFor('correct', { combo: 3 })).toEqual(plain);
    const combo6 = burstFor('correct', { combo: 6 });
    const combo10 = burstFor('correct', { combo: 10 });
    expect(combo6.count!).toBeGreaterThan(plain.count!);
    expect(combo10.power!).toBeGreaterThan(combo6.power!);
  });

  it('makes level up, topic complete and rewards the biggest, with a word', () => {
    for (const event of ['levelUp', 'topicComplete', 'rewardUnlock', 'prizeOpen'] as const) {
      expect(burstFor(event).word, event).toBe(true);
      expect(burstFor(event).count!, event).toBeGreaterThan(burstFor('correct').count!);
    }
  });

  it('keeps the prize box’s wobble puffs small', () => {
    expect(burstFor('prizeWobble').count!).toBeLessThan(10);
    expect(burstFor('prizeWobble').power!).toBeLessThan(1);
  });
});
