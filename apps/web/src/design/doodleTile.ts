/**
 * J8b: the background doodle tile, scattered "topsy-turvy" rather than in a grid.
 *
 * The tile is generated, not drawn by hand, from a fixed seed, so it is identical on every build
 * and can be tested. Points come from Poisson-disc sampling on a torus (no rows or columns, even
 * across the edges); each doodle gets its own angle, size and line weight; and anything that
 * crosses an edge is drawn again on the opposite side, so the repeat has no seams.
 *
 * The committed `doodle-scatter.svg` is this module's output: the test checks it, and
 * `UPDATE_DOODLES=1 vitest run src/design/doodleTile.test.ts` (in apps/web) rewrites it after a
 * change here.
 */

/** Width and height of the tile, in CSS pixels. */
export const TILE_SIZE = 800;
/** The fixed seed the committed tile is made from. */
export const DOODLE_SEED = 20261126;
/** Smallest distance between two doodle centres, in pixels. */
export const MIN_GAP = 60;
/** Furthest any motif reaches from its centre at scale 1 (any rotation, line included). */
export const BOUND = 27;

/**
 * Our own line motifs (original art), each drawn round its centre in about a 36px box. The first
 * sixteen are the J8 tile's doodles, recentred; the rest are new. Stroke-only, no fill.
 */
export const MOTIFS: Readonly<Record<string, string>> = {
  // Pip, the fox
  fox: '<g transform="translate(-18 -18)"><path d="M0 11 6 0l7 8h10l7-8 6 11-6 14-12 10L6 25z"/><path d="M10 15l4-2 2 3M26 15l-4-2-2 3M15 25h6l-3 3z"/></g>',
  pencil: '<path d="M-16-4h24v8h-24zM8-4l8 4-8 4M-10-4v8"/>',
  book: '<path d="M-17-12c6-3 12-3 17 1 5-4 11-4 17-1v24c-6-3-12-3-17 1-5-4-11-4-17-1zM0-11v24"/>',
  pi: '<path d="M-13-10c4-2 8-2 12-1h12M-5-10c0 10-2 18-6 22M5-10c-1 9 0 16 4 20 2 2 4 1 5-1"/>',
  root: '<path d="M-19 2l5-3 6 15 9-28h18M5-4l8 12M13-4l-8 12"/>',
  divide: '<path d="M-13 0h26"/><circle cy="-9" r="2"/><circle cy="9" r="2"/>',
  square: '<path d="M-14-6 2 12M2-6l-16 18M6-12c1-3 7-3 7 1 0 3-7 6-7 8h8"/>',
  graph: '<path d="M-17-16v32h34M-11 8l8-9 7 5 11-14"/>',
  bulb: '<path d="M-2 13V9c0-3-8-6-8-14a10 10 0 0 1 20 0c0 8-8 11-8 14v4M-4 17h8M0-16v-1M-13-11l-1-1M13-11l1-1"/>',
  star: '<path d="M0-15l4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1z"/>',
  trophy:
    '<path d="M-9-15H9v8c0 7-4 12-9 12s-9-5-9-12zM-9-11h-6c0 6 3 9 7 9M9-11h6c0 6-3 9-7 9M0 5v6M-7 16H7v-5H-7z"/>',
  calculator:
    '<path d="M-13-16h26v32h-26zM-9-12H9v7H-9z"/><path d="M-7 1h2M0 1h2M-7 7h2M0 7h2M-7 12h2M0 12h2M7 1v11"/>',
  tube: '<g transform="rotate(-25)"><path d="M-6-16H6M-4-16v26a4 4 0 0 0 8 0v-26M-4 0h8"/><circle cy="7" r="1"/></g>',
  headphones: '<path d="M-14 4v-6a14 14 0 0 1 28 0v6M-16 4h7v11h-7zM9 4h7v11H9z"/>',
  planet: '<circle cy="-1" r="10"/><path d="M-15 4c-6 6 2 7 15 2S19-6 13-8"/>',
  sparkles: '<path d="M-8-14v12M-14-8h12M10 2v10M5 7h10M-10 10l4 4M-6 10l-4 4"/>',
  atom: '<circle r="2.5"/><ellipse rx="17" ry="6"/><ellipse rx="17" ry="6" transform="rotate(60)"/><ellipse rx="17" ry="6" transform="rotate(-60)"/>',
  leaf: '<path d="M-14 14C-14-4-2-14 14-14c0 18-10 28-28 28zM-14 14 5-5M-4 4v-7M2-2h7"/>',
  notes:
    '<path d="M-8 10v-22l18-4v22M-8-6l18-4"/><circle cx="-12" cy="10" r="4"/><circle cx="6" cy="6" r="4"/>',
  flask: '<path d="M-6-16H6M-3-16v10l-11 18a3 3 0 0 0 3 4h22a3 3 0 0 0 3-4L3-6v-10M-9 5H9"/>',
  magnifier: '<circle cx="-4" cy="-4" r="10"/><path d="M3 3l12 12M-9-6a6 6 0 0 1 4-4"/>',
  setsquare: '<path d="M-14 14v-28l28 28zM-8 8V0l8 8z"/>',
  helix: '<path d="M-6-16c12 8 12 24 0 32M6-16c-12 8-12 24 0 32M-3-10h6M-4 0h8M-3 10h6"/>',
  globe:
    '<circle r="14"/><path d="M-14 0h28M0-14c-8 8-8 20 0 28M0-14c8 8 8 20 0 28M-12-7h24M-12 7h24"/>',
  plane: '<path d="M-16-2 16-12 6 14 0 4zM0 4l16-16M0 4v8l4-5"/>',
  moon: '<path d="M4-14a14 14 0 1 0 10 22A11 11 0 1 1 4-14z"/>',
  rocket:
    '<path d="M0-17c6 6 7 15 4 24h-8c-3-9-2-18 4-24zM-4 7l-6 6v-9M4 7l6 6v-9M0 11v5"/><circle cy="-5" r="3"/>',
  compass: '<circle cy="-14" r="2"/><path d="M0-12l-9 26M0-12l9 26M-6 4h12"/>',
  question:
    '<path d="M-15-13h30v18H-2l-8 8v-8h-5zM-3-7c0-4 6-4 6 0 0 3-3 3-3 6"/><circle cy="2" r=".8"/>',
  signs: '<path d="M-14-7h10M-9-12v10M4-7h10M-14 8h10M4 4l10 8M14 4 4 12"/>',
  cloud: '<path d="M-12 8a6 6 0 0 1 0-12 9 9 0 0 1 17-3 6 6 0 0 1 7 15z"/>',
  ruler: '<path d="M-17-5h34V5h-34zM-11-5v4M-5-5v6M1-5v4M7-5v6M13-5v4"/>',
  hexagon: '<path d="M0-15 13-7.5v15L0 15-13 7.5v-15z"/><circle r="7"/>',
  wave: '<path d="M-17 0c4-12 7-12 11 0s7 12 11 0 7-12 11 0"/>',
  tick: '<path d="M-12 0l8 8 16-18"/>',
  cap: '<path d="M-17-4 0-12 17-4 0 4zM-10-1v8c6 4 14 4 20 0v-8M14-3v10"/>',
};

/** One doodle on the tile: which motif, where its centre is, and how it is turned and drawn. */
export interface Placement {
  readonly motif: string;
  readonly x: number;
  readonly y: number;
  /** Degrees, 0 to under 360. */
  readonly rotate: number;
  /** 0.6 to 1.4 times the motif's own size. */
  readonly scale: number;
  /** Line weight as drawn, in pixels (1.2 to 2.2), whatever the scale. */
  readonly stroke: number;
}

/** A small seeded random number generator (mulberry32): numbers from 0 up to 1. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number, places: number) => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};

/**
 * Poisson-disc points (Bridson's method) on a square that wraps round at its edges, so no two
 * points are closer than `gap`, even across an edge. Coordinates are rounded to 0.1px.
 */
export function scatter(
  random: () => number,
  size: number,
  gap: number,
  attempts = 30,
): { x: number; y: number }[] {
  const cell = gap / Math.SQRT2;
  const cells = Math.floor(size / cell);
  const cellSize = size / cells;
  const grid: (number | undefined)[] = new Array(cells * cells);
  const points: { x: number; y: number }[] = [];
  const wrap = (v: number) => ((v % size) + size) % size;
  const cellOf = (v: number) => Math.min(cells - 1, Math.floor(v / cellSize));

  const fits = (x: number, y: number) => {
    const cx = cellOf(x);
    const cy = cellOf(y);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const i = grid[((cy + dy + cells) % cells) * cells + ((cx + dx + cells) % cells)];
        if (i === undefined) continue;
        const p = points[i]!;
        const ox = Math.min(Math.abs(p.x - x), size - Math.abs(p.x - x));
        const oy = Math.min(Math.abs(p.y - y), size - Math.abs(p.y - y));
        if (Math.hypot(ox, oy) < gap) return false;
      }
    }
    return true;
  };

  const add = (x: number, y: number) => {
    grid[cellOf(y) * cells + cellOf(x)] = points.length;
    points.push({ x, y });
  };

  add(round(random() * size, 1) % size, round(random() * size, 1) % size);
  const active = [0];
  while (active.length > 0) {
    const pick = Math.floor(random() * active.length);
    const from = points[active[pick]!]!;
    let placed = false;
    for (let k = 0; k < attempts; k++) {
      const angle = random() * Math.PI * 2;
      const distance = gap * (1 + random());
      const x = round(wrap(from.x + Math.cos(angle) * distance), 1) % size;
      const y = round(wrap(from.y + Math.sin(angle) * distance), 1) % size;
      if (fits(x, y)) {
        add(x, y);
        active.push(points.length - 1);
        placed = true;
        break;
      }
    }
    if (!placed) active.splice(pick, 1);
  }
  return points;
}

/** Shuffles a copy of a list with the given randomness (Fisher–Yates). */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Scatters the doodles for a seed: every motif used, as evenly as the count allows. */
export function placeDoodles(seed: number = DOODLE_SEED): Placement[] {
  const random = seededRandom(seed);
  const points = scatter(random, TILE_SIZE, MIN_GAP);
  const names = Object.keys(MOTIFS);
  const deck: string[] = [];
  while (deck.length < points.length) deck.push(...shuffled(names, random));
  return points.map((p, i) => ({
    motif: deck[i]!,
    x: p.x,
    y: p.y,
    rotate: round(random() * 359.9, 1),
    scale: round(0.6 + random() * 0.8, 2),
    stroke: round(1.2 + random() * 1, 1),
  }));
}

/** The tile as SVG markup: motifs defined once, each doodle (and its edge copies) a `<use>`. */
export function renderDoodleTile(placements: readonly Placement[]): string {
  const used = Object.keys(MOTIFS).filter((name) => placements.some((p) => p.motif === name));
  const defs = used.map((name) => `<g id="${name}">${MOTIFS[name]}</g>`).join('\n');
  const uses: string[] = [];
  for (const p of placements) {
    const reach = BOUND * p.scale;
    const xs = [p.x];
    const ys = [p.y];
    if (p.x < reach) xs.push(round(p.x + TILE_SIZE, 1));
    if (p.x > TILE_SIZE - reach) xs.push(round(p.x - TILE_SIZE, 1));
    if (p.y < reach) ys.push(round(p.y + TILE_SIZE, 1));
    if (p.y > TILE_SIZE - reach) ys.push(round(p.y - TILE_SIZE, 1));
    const width = round(p.stroke / p.scale, 2);
    for (const y of ys) {
      for (const x of xs) {
        uses.push(
          `<use href="#${p.motif}" transform="translate(${x} ${y}) rotate(${p.rotate}) scale(${p.scale})" stroke-width="${width}"/>`,
        );
      }
    }
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE}" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">`,
    '<!-- RevisionDen doodle tile (J8b): original line drawings, scattered at random angles and sizes',
    '     from a fixed seed. Generated by apps/web/src/design/doodleTile.ts; do not edit by hand.',
    '     Used as a CSS mask; colour comes from the theme. -->',
    `<defs>\n${defs}\n</defs>`,
    ...uses,
    '</svg>',
    '',
  ].join('\n');
}
