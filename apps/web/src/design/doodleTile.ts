/**
 * J8b: the background doodle tile, a dense hand-drawn sticker sheet (the WhatsApp-wallpaper
 * technique, with our own motifs) rather than a grid.
 *
 * The tile is generated, not drawn by hand, from a fixed seed, so it is identical on every build
 * and can be tested. A few big hero doodles go down first, then as many medium doodles as fit, then
 * tiny fillers in the gaps; each is kept a few pixels clear of its neighbours, measured on a tile
 * that wraps round at the edges. Doodles sit upright or tilted by up to 25 degrees, all in one
 * thin line weight, and anything that crosses an edge is drawn again on the opposite side, so the
 * repeat has no seams.
 *
 * The committed `doodle-scatter.svg` is this module's output: the test checks it, and
 * `UPDATE_DOODLES=1 npx vitest run src/design/doodleTile.test.ts` (in apps/web) rewrites it after
 * a change here.
 */

/** Width and height of the tile, in CSS pixels. */
export const TILE_SIZE = 1080;
/** The fixed seed the committed tile is made from. */
export const DOODLE_SEED = 20261126;
/** Line weight as drawn, in pixels, the same for every doodle. */
export const STROKE = 1.4;
/** Clear space between neighbouring doodles, in pixels. */
export const GAP = 4;

/**
 * Our own line motifs (original art), each drawn round its centre in about a 36px box (fillers in
 * about 8px). Stroke-only, no fill. The first sixteen are the J8 tile's doodles, recentred.
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
  magnet: '<path d="M-10-12v10a10 10 0 0 0 20 0v-10h-6v10a4 4 0 0 1-8 0v-10zM-10-6h6M4-6h6"/>',
  paperclip: '<path d="M-4 14V-10a5 5 0 0 1 10 0v20a3 3 0 0 1-6 0V-8"/>',
  protractor:
    '<path d="M-16 8a16 16 0 0 1 32 0zM-8 8a8 8 0 0 1 16 0M0 8v-14M-11-3l3 3M11-3l-3 3"/>',
  pie: '<circle r="13"/><path d="M0 0v-13M0 0l11 7"/>',
  sun: '<circle r="6"/><path d="M0-15v4M0 11v4M-15 0h4M11 0h4M-10.6-10.6l2.8 2.8M7.8 7.8l2.8 2.8M-10.6 10.6l2.8-2.8M7.8-7.8l2.8-2.8"/>',
  // Hero doodles: drawn in the same ~36px box with more detail, shown about three times larger.
  foxReading:
    '<g transform="translate(-11 -19) scale(.62)"><path d="M0 11 6 0l7 8h10l7-8 6 11-6 14-12 10L6 25z"/><path d="M10 15l4-2 2 3M26 15l-4-2-2 3M15 25h6l-3 3z"/></g><path d="M-17 4c6-3 12-3 17 1 5-4 11-4 17-1v13c-6-3-12-3-17 1-5-4-11-4-17-1zM0 5v13M-13 8h8M-13 11h7M-13 14h8M5 8h8M6 11h7M5 14h8"/>',
  bookStack:
    '<path d="M-15 8h30v8h-30zM-12 0h26v8h-26zM-16-8h28v8h-28zM-10 8v8M9 0v8M-12-8v8M-6 12h16M-6 4h14M-8-4h16"/><path d="M2-11c-4-4-9 0-6 4 2 3 4 3 6 2 2 1 4 1 6-2 3-4-2-8-6-4zM2-11c0-2 1-4 3-5"/>',
  labBench:
    '<path d="M-12-16h8M-10-16v8l-8 16a3 3 0 0 0 3 4h14a3 3 0 0 0 3-4l-8-16v-8M-16 4h14M8-14h8M10-14v24a2 2 0 0 0 4 0v-24M10 0h4M-19 18h38"/><circle cx="-6" cy="-12" r="1"/><circle cx="-4" cy="0" r="1.5"/><circle cx="-9" cy="-3" r="1"/>',
  rocketTrip:
    '<path d="M2-18c6 6 7 15 4 24h-8c-3-9-2-18 4-24zM-2 6l-6 6v-9M6 6l6 6v-9M2 10v6M-2 14l-2 4M6 14l2 4"/><circle cx="2" cy="-6" r="3"/><path d="M-16-12h0M-12 2h0M14-14h0M16 0h0M-15-4l2 2M12 10l2 2"/>',
  globeStand:
    '<circle cy="-4" r="13"/><path d="M-13-4h26M0-17c-7 7-7 19 0 26M0-17c7 7 7 19 0 26M-11-11h22M-11 3h22M-16-4a16 16 0 0 0 26 12M0 12v5M-8 18h16"/>',
  bigCalculator:
    '<path d="M-13-17h26v34h-26zM-9-13H9v8H-9zM-7-8h4"/><path d="M-7 0h2M-1 0h2M5 0h2M-7 5h2M-1 5h2M5 5h2M-7 10h2M-1 10h2M5 10v4M-7 14h8"/>',
  ringedPlanet:
    '<circle r="11"/><path d="M-19 5c-5 6 4 7 19 1s23-14 18-18c-2-2-7-1-12 1M-5-6a6 6 0 0 1 6-3"/><circle cx="16" cy="-14" r="2"/><path d="M-16-14v4M-18-12h4"/>',
  trophyCup:
    '<path d="M-9-16H9v9c0 7-4 12-9 12s-9-5-9-12zM-9-12h-6c0 6 3 10 7 10M9-12h6c0 6-3 10-7 10M0 5v6M-8 17H8v-6H-8zM-3-10l3-3 3 3M0-13v9"/>',
  // Fillers: tiny shapes that plug the gaps, drawn in about an 8px box.
  dot: '<circle r=".8"/>',
  ring: '<circle r="2.6"/>',
  sparkle: '<path d="M0-4.5C0-1 1 0 4.5 0 1 0 0 1 0 4.5 0 1-1 0-4.5 0-1 0 0-1 0-4.5z"/>',
  plus: '<path d="M0-3v6M-3 0h6"/>',
  tinyStar: '<path d="M0-4l1.2 2.6 2.8.3-2.1 1.9.6 2.8L0 2.2-2.5 3.6l.6-2.8L-4-1.1l2.8-.3z"/>',
  dash: '<path d="M-3 0h6"/>',
  triangle: '<path d="M0-3 3 2.5h-6z"/>',
};

/** Motifs used as big hero doodles. */
export const HEROES: readonly string[] = [
  'foxReading',
  'bookStack',
  'labBench',
  'rocketTrip',
  'globeStand',
  'bigCalculator',
  'ringedPlanet',
  'trophyCup',
];
/** Motifs used as tiny fillers. */
export const FILLERS: readonly string[] = [
  'dot',
  'ring',
  'sparkle',
  'plus',
  'tinyStar',
  'dash',
  'triangle',
];
/** Everything else is a medium doodle. */
const MEDIUMS = Object.keys(MOTIFS).filter((m) => !HEROES.includes(m) && !FILLERS.includes(m));

/** One doodle on the tile: which motif, its size tier, where its centre is, and how it is turned. */
export interface Placement {
  readonly motif: string;
  readonly tier: 'hero' | 'medium' | 'filler';
  readonly x: number;
  readonly y: number;
  /** Degrees: -25 to 25 for heroes and medium doodles, any angle for fillers. */
  readonly rotate: number;
  /** Times the motif's own size. */
  readonly scale: number;
}

/** How far a doodle's drawing reaches from its centre (the circle kept clear of others). */
export function radius(p: Pick<Placement, 'tier' | 'scale'>): number {
  return (p.tier === 'filler' ? 4.5 : 18) * p.scale;
}

/** How far past an edge a doodle can poke out (corners included), so it is drawn again there. */
export function reach(p: Pick<Placement, 'tier' | 'scale'>): number {
  return radius(p) * 1.4 + STROKE;
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

/** Shuffles a copy of a list with the given randomness (Fisher–Yates). */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

interface Tier {
  readonly tier: Placement['tier'];
  readonly motifs: readonly string[];
  readonly scale: readonly [number, number];
  readonly tilt: number;
  /** Extra space kept round this tier, on top of GAP (spreads the heroes out). */
  readonly spread: number;
  /** Stop after this many misses in a row (or at `max` doodles). */
  readonly misses: number;
  readonly max: number;
}

const TIERS: readonly Tier[] = [
  { tier: 'hero', motifs: HEROES, scale: [2.9, 3.4], tilt: 18, spread: 160, misses: 4000, max: 8 },
  {
    tier: 'medium',
    motifs: MEDIUMS,
    scale: [0.95, 1.35],
    tilt: 25,
    spread: 0,
    misses: 6000,
    max: 2000,
  },
  {
    tier: 'filler',
    motifs: FILLERS,
    scale: [0.8, 1.2],
    tilt: 180,
    spread: 0,
    misses: 8000,
    max: 4000,
  },
];

/** Packs the doodles for a seed: heroes, then medium doodles, then fillers, every one kept clear. */
export function placeDoodles(seed: number = DOODLE_SEED): Placement[] {
  const random = seededRandom(seed);
  const placed: Placement[] = [];
  const cell = 64;
  const cells = Math.floor(TILE_SIZE / cell);
  const cellSize = TILE_SIZE / cells;
  const grid: Placement[][] = Array.from({ length: cells * cells }, () => []);
  const heroes: Placement[] = [];
  const cellOf = (v: number) => Math.min(cells - 1, Math.floor(v / cellSize));
  const clear = (c: Placement, spread: number) => {
    const fits = (p: Placement) => {
      const dx = Math.min(Math.abs(p.x - c.x), TILE_SIZE - Math.abs(p.x - c.x));
      const dy = Math.min(Math.abs(p.y - c.y), TILE_SIZE - Math.abs(p.y - c.y));
      const need =
        radius(p) + radius(c) + GAP + (p.tier === 'hero' && c.tier === 'hero' ? spread : 0);
      return Math.hypot(dx, dy) >= need;
    };
    if (!heroes.every(fits)) return false;
    const cx = cellOf(c.x);
    const cy = cellOf(c.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = grid[((cy + dy + cells) % cells) * cells + ((cx + dx + cells) % cells)]!;
        if (!bucket.every(fits)) return false;
      }
    }
    return true;
  };

  for (const t of TIERS) {
    let deck: string[] = [];
    let misses = 0;
    let count = 0;
    while (misses < t.misses && count < t.max) {
      if (deck.length === 0) deck = shuffled(t.motifs, random);
      const [lo, hi] = t.scale;
      const c: Placement = {
        motif: deck[deck.length - 1]!,
        tier: t.tier,
        x: round(random() * TILE_SIZE, 1) % TILE_SIZE,
        y: round(random() * TILE_SIZE, 1) % TILE_SIZE,
        rotate: round((random() * 2 - 1) * t.tilt, 1),
        scale: round(lo + random() * (hi - lo), 2),
      };
      if (!clear(c, t.spread)) {
        misses++;
        continue;
      }
      deck.pop();
      misses = 0;
      count++;
      placed.push(c);
      if (c.tier === 'hero') heroes.push(c);
      else grid[cellOf(c.y) * cells + cellOf(c.x)]!.push(c);
    }
  }
  return placed;
}

/** The tile as SVG markup: motifs defined once, each doodle (and its edge copies) a `<use>`. */
export function renderDoodleTile(placements: readonly Placement[]): string {
  const used = Object.keys(MOTIFS).filter((name) => placements.some((p) => p.motif === name));
  const defs = used.map((name) => `<g id="${name}">${MOTIFS[name]}</g>`).join('\n');
  const uses: string[] = [];
  for (const p of placements) {
    const r = reach(p);
    const xs = [p.x];
    const ys = [p.y];
    if (p.x < r) xs.push(round(p.x + TILE_SIZE, 1));
    if (p.x > TILE_SIZE - r) xs.push(round(p.x - TILE_SIZE, 1));
    if (p.y < r) ys.push(round(p.y + TILE_SIZE, 1));
    if (p.y > TILE_SIZE - r) ys.push(round(p.y - TILE_SIZE, 1));
    const width = round(STROKE / p.scale, 2);
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
    '<!-- RevisionDen doodle tile (J8b): original line drawings packed like a sticker sheet, from a',
    '     fixed seed. Generated by apps/web/src/design/doodleTile.ts; do not edit by hand. Used as a',
    '     CSS mask; colour comes from the theme. -->',
    `<defs>\n${defs}\n</defs>`,
    ...uses,
    '</svg>',
    '',
  ].join('\n');
}
