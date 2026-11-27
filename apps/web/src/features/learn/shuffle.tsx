import { createContext, useContext, useState, type ReactNode } from 'react';
import { shuffledOptionOrder, type Rng } from '@revisionden/core';

/**
 * F22: the randomness behind the order multiple choice options are shown in. `Math.random` in the
 * app; tests pass a seeded `createRng` so an order can be replayed.
 */
const ShuffleContext = createContext<Rng>(Math.random);

export function ShuffleProvider({ rng, children }: { rng: Rng; children: ReactNode }) {
  return <ShuffleContext.Provider value={rng}>{children}</ShuffleContext.Provider>;
}

/**
 * The order to show these options in (their original positions), chosen once when the question
 * appears: a fresh order each time it is served, steady while it is on screen.
 */
export function useOptionOrder(options: readonly string[]): number[] {
  const rng = useContext(ShuffleContext);
  const [order] = useState(() => shuffledOptionOrder(options, rng));
  // Same length guard: if the options ever change under the same element, show them in order.
  return order.length === options.length ? order : options.map((_, i) => i);
}
