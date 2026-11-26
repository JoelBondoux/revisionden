import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  BOUND,
  DOODLE_SEED,
  MIN_GAP,
  MOTIFS,
  TILE_SIZE,
  placeDoodles,
  renderDoodleTile,
  scatter,
  seededRandom,
} from './doodleTile';

// J8b: the background doodles, scattered "topsy-turvy" instead of in a visible grid. The tile is
// generated from a fixed seed, so it is the same on every build and can be checked here.
const css = readFileSync(join(import.meta.dirname, 'themes.css'), 'utf8');
const placements = placeDoodles();
const tile = renderDoodleTile(placements);

/** The shortest distance between two points on a tile that wraps round at both edges. */
function wrappedDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = Math.min(Math.abs(a.x - b.x), TILE_SIZE - Math.abs(a.x - b.x));
  const dy = Math.min(Math.abs(a.y - b.y), TILE_SIZE - Math.abs(a.y - b.y));
  return Math.hypot(dx, dy);
}

describe('seeded randomness', () => {
  it('gives the same numbers for the same seed and different ones for another', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const c = seededRandom(8);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    for (const n of first) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('scattering on a wrap-round tile', () => {
  it('keeps every point at least the gap from every other, across the edges too', () => {
    const points = scatter(seededRandom(1), 400, 50);
    expect(points.length).toBeGreaterThan(20);
    for (const [i, p] of points.entries()) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(400);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(400);
      for (const q of points.slice(i + 1)) {
        const dx = Math.min(Math.abs(p.x - q.x), 400 - Math.abs(p.x - q.x));
        const dy = Math.min(Math.abs(p.y - q.y), 400 - Math.abs(p.y - q.y));
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(50);
      }
    }
  });
});

describe('the doodle tile', () => {
  it('draws from a large set of original motifs and uses every one', () => {
    expect(Object.keys(MOTIFS).length).toBeGreaterThanOrEqual(24);
    expect(new Set(placements.map((p) => p.motif))).toEqual(new Set(Object.keys(MOTIFS)));
  });

  it('places between 80 and 120 doodles, none overlapping, even across the edges', () => {
    expect(placements.length).toBeGreaterThanOrEqual(80);
    expect(placements.length).toBeLessThanOrEqual(120);
    for (const [i, p] of placements.entries()) {
      for (const q of placements.slice(i + 1)) {
        expect(wrappedDistance(p, q)).toBeGreaterThanOrEqual(MIN_GAP);
      }
    }
  });

  it('gives each doodle its own angle, size and line weight', () => {
    for (const p of placements) {
      expect(p.rotate).toBeGreaterThanOrEqual(0);
      expect(p.rotate).toBeLessThan(360);
      expect(p.scale).toBeGreaterThanOrEqual(0.6);
      expect(p.scale).toBeLessThanOrEqual(1.4);
      expect(p.stroke).toBeGreaterThanOrEqual(1.2);
      expect(p.stroke).toBeLessThanOrEqual(2.2);
    }
    // Any angle, not a handful of fixed tilts.
    expect(new Set(placements.map((p) => Math.round(p.rotate))).size).toBeGreaterThan(60);
    expect(new Set(placements.map((p) => p.scale.toFixed(1))).size).toBeGreaterThanOrEqual(8);
  });

  it('has no rows or columns: never more than three doodles on one line across or down', () => {
    for (const p of placements) {
      const sameRow = placements.filter((q) => q !== p && Math.abs(q.y - p.y) < 2).length;
      const sameColumn = placements.filter((q) => q !== p && Math.abs(q.x - p.x) < 2).length;
      expect(sameRow).toBeLessThanOrEqual(3);
      expect(sameColumn).toBeLessThanOrEqual(3);
    }
  });

  it('draws a doodle again on the opposite side when it crosses an edge, so the seams never show', () => {
    const near = (v: number) => v < 30 || v > TILE_SIZE - 30;
    const crossing = placements.filter((p) => near(p.x) || near(p.y));
    expect(crossing.length).toBeGreaterThan(0);
    const drawn = (tile.match(/<use /g) ?? []).length;
    const copies = placements.reduce((n, p) => {
      const r = BOUND * p.scale;
      const xs = p.x < r || p.x > TILE_SIZE - r ? 2 : 1;
      const ys = p.y < r || p.y > TILE_SIZE - r ? 2 : 1;
      return n + xs * ys;
    }, 0);
    expect(drawn).toBe(copies);
    expect(drawn).toBeGreaterThan(placements.length);
  });

  it('is the same every time for the same seed, and different for another', () => {
    expect(renderDoodleTile(placeDoodles(DOODLE_SEED))).toBe(tile);
    expect(renderDoodleTile(placeDoodles(DOODLE_SEED + 1))).not.toBe(tile);
  });

  it('is one small square SVG, under 60KB gzipped', () => {
    expect(tile).toMatch(
      new RegExp(
        `^<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE}"`,
      ),
    );
    expect(gzipSync(tile).length).toBeLessThan(60 * 1024);
  });

  it('is committed exactly as generated (UPDATE_DOODLES=1 rewrites it)', () => {
    const file = join(import.meta.dirname, 'doodle-scatter.svg');
    if (process.env.UPDATE_DOODLES === '1') writeFileSync(file, tile);
    expect(readFileSync(file, 'utf8')).toBe(tile);
  });

  it('is the mask behind the app at its own size', () => {
    expect(css).toContain(
      `mask: url('./doodle-scatter.svg') 0 0 / ${TILE_SIZE}px ${TILE_SIZE}px repeat;`,
    );
    expect(css).toContain(
      `-webkit-mask: url('./doodle-scatter.svg') 0 0 / ${TILE_SIZE}px ${TILE_SIZE}px repeat;`,
    );
  });
});
