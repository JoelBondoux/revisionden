/** Seeded randomness so selection and any other random choice can be replayed in tests. */
export type Rng = () => number;

/** Mulberry32: small, fast, good enough for picking practice items. Returns numbers in [0, 1). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks one option with probability proportional to its weight. */
export function weightedPick<T>(options: readonly (readonly [T, number])[], rng: Rng): T {
  const total = options.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  if (total <= 0) throw new Error('weightedPick needs at least one positive weight');
  let target = rng() * total;
  let last: T | undefined;
  for (const [option, weight] of options) {
    if (weight <= 0) continue;
    last = option;
    target -= weight;
    if (target < 0) return option;
  }
  return last as T;
}
