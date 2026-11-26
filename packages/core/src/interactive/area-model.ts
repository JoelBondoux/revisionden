/**
 * The area model for factorising x² + bx + c (interactive lesson pilot, workstream W8).
 *
 * x² + bx + c is drawn as one x-by-x square, b strips (x by 1) and c unit squares. When the
 * strips split into p along one side and q along the other, with p × q = c and p + q = b, the
 * tiles make a rectangle whose sides are (x + p) and (x + q).
 *
 * Pilot scope A (owner, 2026-11-26): b and c are positive whole numbers. Pure functions only.
 */

export interface AreaModelQuadratic {
  /** Coefficient of x. */
  b: number;
  /** Constant term. */
  c: number;
}

/** Two whole numbers, smaller first. */
export type AreaModelPair = readonly [number, number];

/** Largest numbers the pilot draws as tiles, so the picture fits a phone screen. */
export const AREA_MODEL_LIMITS = { maxB: 13, maxC: 36 } as const;

const isWhole = (n: number) => Number.isInteger(n);
const sorted = ([p, q]: AreaModelPair): AreaModelPair => (p <= q ? [p, q] : [q, p]);

/** Every pair of positive whole numbers that multiply to c, smaller first. */
export function factorPairs(c: number): AreaModelPair[] {
  if (!isWhole(c) || c < 1) return [];
  const pairs: AreaModelPair[] = [];
  for (let p = 1; p * p <= c; p += 1) if (c % p === 0) pairs.push([p, c / p]);
  return pairs;
}

/** The factor pair of c that adds to b, or null when there is none. */
export function correctPair({ b, c }: AreaModelQuadratic): AreaModelPair | null {
  return factorPairs(c).find(([p, q]) => p + q === b) ?? null;
}

/** True when the quadratic is in the pilot's scope: b, c positive whole numbers that factorise. */
export function isScopeA(quadratic: AreaModelQuadratic): boolean {
  const { b, c } = quadratic;
  if (!isWhole(b) || !isWhole(c) || b < 1 || c < 1) return false;
  if (b > AREA_MODEL_LIMITS.maxB || c > AREA_MODEL_LIMITS.maxC) return false;
  return correctPair(quadratic) !== null;
}

export interface AreaModelCheck {
  correct: boolean;
  sum: number;
  product: number;
}

/** Whether a chosen pair splits the middle term: it must multiply to c and add to b. */
export function checkAreaModelPair(
  { b, c }: AreaModelQuadratic,
  pair: AreaModelPair,
): AreaModelCheck {
  const [p, q] = pair;
  const sum = p + q;
  const product = p * q;
  return { correct: sum === b && product === c, sum, product };
}

/** The answer as sent to the server: the pair, smaller first ("2,3"). */
export function formatAreaModelAnswer(pair: AreaModelPair): string {
  const [p, q] = sorted(pair);
  return `${p},${q}`;
}

/** Reads an answer written by formatAreaModelAnswer; null unless it is two positive whole numbers. */
export function parseAreaModelAnswer(text: string): AreaModelPair | null {
  const parts = text.split(',').map((part) => part.trim());
  if (parts.length !== 2 || !parts.every((part) => /^\d+$/.test(part))) return null;
  const [p, q] = parts.map(Number) as [number, number];
  if (p < 1 || q < 1) return null;
  return sorted([p, q]);
}

/** "x^2 + 5x + 6" (the app's stored maths notation; the screen shows superscripts). */
export function quadraticText({ b, c }: AreaModelQuadratic): string {
  const terms = ['x^2'];
  if (b) terms.push(b === 1 ? 'x' : `${b}x`);
  if (c) terms.push(String(c));
  return terms.join(' + ');
}

/** "(x + 2)(x + 3)", smaller number first. */
export function factorisedForm(pair: AreaModelPair): string {
  const [p, q] = sorted(pair);
  return `(x + ${p})(x + ${q})`;
}

export interface AreaModelLayout {
  /** The x² square, always in the top-left corner. */
  square: { row: 0; col: 0 };
  /** x strips standing to the right of the square (one per unit of q). */
  rightStrips: number;
  /** x strips lying below the square (one per unit of p). */
  bottomStrips: number;
  /** Unit squares filling the bottom-right corner, p rows by q columns, row by row. */
  units: { row: number; col: number }[];
  /** Side labels, read as the two brackets. */
  sides: { top: [string, string]; left: [string, string] };
}

/** Where every tile goes once the pair is chosen; the screen turns this into pixels. */
export function areaModelLayout(pair: AreaModelPair): AreaModelLayout {
  const [p, q] = sorted(pair);
  const units: { row: number; col: number }[] = [];
  for (let row = 0; row < p; row += 1)
    for (let col = 0; col < q; col += 1) units.push({ row, col });
  return {
    square: { row: 0, col: 0 },
    rightStrips: q,
    bottomStrips: p,
    units,
    sides: { top: ['x', `+${q}`], left: ['x', `+${p}`] },
  };
}

export type AreaModelTile = 'square' | 'strip' | 'unit';

/** What a tile is and how it adds up to its term, for the quadratic on screen. */
export function tileExplanation(tile: AreaModelTile, { b, c }: AreaModelQuadratic): string {
  const count = (n: number, term: string) =>
    n === 1 ? `There is just 1: ${term}.` : `There are ${n} of them: ${term}.`;
  if (tile === 'square') return 'The x² square. It is x by x, so its area is x².';
  if (tile === 'strip') {
    return `An x strip. It is x by 1, so its area is x. ${count(b, b === 1 ? 'x' : `${b}x`)}`;
  }
  return `A unit square. It is 1 by 1, so its area is 1. ${count(c, String(c))}`;
}
