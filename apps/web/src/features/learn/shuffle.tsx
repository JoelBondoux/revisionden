import { createContext, useContext, useState, type ReactNode } from 'react';
import { shuffledOptionOrder, type LearnItem, type Rng } from '@revisionden/core';

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

/**
 * The order for one serve of a question (Codex on #448): a fresh order whenever `serve` changes,
 * even for the same item (a missed question that comes straight back), and steady while it is on
 * screen. Shared by the answers and read aloud, so the spoken option numbers match the screen.
 * Undefined for anything but multiple choice.
 */
export function useServedOptionOrder(
  item: LearnItem | undefined,
  serve: number | string,
): number[] | undefined {
  const rng = useContext(ShuffleContext);
  const key = `${serve}:${item?.id ?? ''}`;
  const draw = () =>
    item?.type === 'multiple_choice' ? shuffledOptionOrder(item.options, rng) : undefined;
  const [served, setServed] = useState(() => ({ key, order: draw() }));
  if (served.key !== key) {
    const next = { key, order: draw() };
    setServed(next);
    return next.order;
  }
  return served.order;
}
