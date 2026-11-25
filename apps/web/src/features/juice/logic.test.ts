import {
  MAX_CONFETTI,
  MAX_PARTICLES,
  burstParticles,
  comboStep,
  confettiPieces,
  nextCombo,
  pastDailyCap,
  pipLine,
  rollValue,
  showsComboBadge,
  starsForSet,
} from './logic';

/** A repeatable stand-in for Math.random. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe('particle burst', () => {
  it('makes about 20 particles by default', () => {
    expect(burstParticles(undefined, seeded())).toHaveLength(20);
  });

  it('never makes more than the cap, however many are asked for', () => {
    expect(burstParticles(500, seeded())).toHaveLength(MAX_PARTICLES);
    expect(MAX_PARTICLES).toBeLessThanOrEqual(24);
  });

  it('spreads particles in every direction from the centre', () => {
    const particles = burstParticles(20, seeded(7));
    expect(particles.some((p) => p.dx < 0)).toBe(true);
    expect(particles.some((p) => p.dx > 0)).toBe(true);
    expect(particles.some((p) => p.dy < 0)).toBe(true);
    for (const p of particles) expect(Math.hypot(p.dx, p.dy)).toBeLessThanOrEqual(90);
  });

  it('gives the same burst for the same random numbers', () => {
    expect(burstParticles(10, seeded(3))).toEqual(burstParticles(10, seeded(3)));
  });
});

describe('confetti', () => {
  it('is capped and starts every piece above the screen', () => {
    const pieces = confettiPieces(1000, seeded());
    expect(pieces).toHaveLength(MAX_CONFETTI);
    for (const p of pieces) {
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.left).toBeLessThanOrEqual(100);
      expect(p.delayMs).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('set-complete stars', () => {
  it('gives 3 stars for 5 out of 5', () => {
    expect(starsForSet(5, 5)).toBe(3);
  });

  it('gives 2 stars for 3 or 4 out of 5', () => {
    expect(starsForSet(4, 5)).toBe(2);
    expect(starsForSet(3, 5)).toBe(2);
  });

  it('gives 1 star otherwise, so effort always earns something', () => {
    expect(starsForSet(2, 5)).toBe(1);
    expect(starsForSet(0, 5)).toBe(1);
    expect(starsForSet(0, 0)).toBe(1);
  });

  it('scales to sets of other sizes', () => {
    expect(starsForSet(10, 10)).toBe(3);
    expect(starsForSet(6, 10)).toBe(2);
    expect(starsForSet(5, 10)).toBe(1);
  });
});

describe('combo', () => {
  it('counts right answers in a row and quietly resets on a wrong one', () => {
    expect(nextCombo(0, true)).toBe(1);
    expect(nextCombo(4, true)).toBe(5);
    expect(nextCombo(4, false)).toBe(0);
  });

  it('shows the badge from 2 right in a row', () => {
    expect(showsComboBadge(1)).toBe(false);
    expect(showsComboBadge(2)).toBe(true);
  });

  it('raises the chime one step per combo, up to 6', () => {
    expect(comboStep(0)).toBe(0);
    expect(comboStep(3)).toBe(3);
    expect(comboStep(9)).toBe(6);
  });
});

describe('Pip lines', () => {
  it('warms up on the first question', () => {
    expect(pipLine({ index: 0, total: 5, combo: 0 })).toMatch(/warm-up/i);
  });

  it('cheers a combo', () => {
    expect(pipLine({ index: 2, total: 5, combo: 3 })).toMatch(/3 in a row/);
  });

  it('calls out the last question', () => {
    expect(pipLine({ index: 4, total: 5, combo: 4 })).toMatch(/last one/i);
  });

  it('is encouraging, never a fail word', () => {
    for (let index = 0; index < 5; index += 1) {
      for (const combo of [0, 1, 2, 5]) {
        expect(pipLine({ index, total: 5, combo })).not.toMatch(/fail|lose|lost|wrong/i);
      }
    }
  });
});

describe('rolling counter', () => {
  it('starts at the old value and ends exactly at the new one', () => {
    expect(rollValue(40, 70, 0)).toBe(40);
    expect(rollValue(40, 70, 1)).toBe(70);
    expect(rollValue(40, 70, 2)).toBe(70);
  });

  it('eases out, so it moves fastest at the start', () => {
    expect(rollValue(0, 100, 0.5)).toBeGreaterThan(50);
  });
});

describe('daily cap', () => {
  it('is reached at the daily reward XP cap (300 XP), not before', () => {
    expect(pastDailyCap(299)).toBe(false);
    expect(pastDailyCap(300)).toBe(true);
  });
});
