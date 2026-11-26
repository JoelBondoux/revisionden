import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  DOODLE_SEED,
  FILLERS,
  GAP,
  HEROES,
  MOTIFS,
  STROKE,
  TILE_SIZE,
  type Placement,
  placeDoodles,
  radius,
  reach,
  renderDoodleTile,
  seededRandom,
} from './doodleTile';

// J8b: the background doodles as a dense, hand-drawn sticker sheet (WhatsApp-wallpaper technique,
// our own motifs): a few big hero doodles, lots of medium ones, and tiny fillers in every gap.
// Generated from a fixed seed, so it is the same on every build and can be checked here.
const css = readFileSync(join(import.meta.dirname, 'themes.css'), 'utf8');
const placements = placeDoodles();
const tile = renderDoodleTile(placements);
const tier = (t: Placement['tier']) => placements.filter((p) => p.tier === t);

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

describe('the doodle tile', () => {
  it('is a large tile, so the repeat stays hidden', () => {
    expect(TILE_SIZE).toBeGreaterThanOrEqual(1000);
    expect(TILE_SIZE).toBeLessThanOrEqual(1200);
  });

  it('mixes three sizes: a few big heroes, many medium doodles and lots of tiny fillers', () => {
    expect(tier('hero').length).toBeGreaterThanOrEqual(6);
    expect(tier('hero').length).toBeLessThanOrEqual(12);
    expect(tier('medium').length).toBeGreaterThanOrEqual(230);
    expect(tier('filler').length).toBeGreaterThanOrEqual(200);
    const meanMedium = tier('medium').reduce((n, p) => n + p.scale, 0) / tier('medium').length;
    for (const h of tier('hero')) expect(h.scale).toBeGreaterThanOrEqual(meanMedium * 2.5);
    const smallestMedium = Math.min(...tier('medium').map(radius));
    for (const f of tier('filler')) expect(radius(f)).toBeLessThan(smallestMedium / 2);
  });

  it('draws from a large set of original motifs and uses every one', () => {
    const mediums = Object.keys(MOTIFS).filter((m) => !HEROES.includes(m) && !FILLERS.includes(m));
    expect(mediums.length).toBeGreaterThanOrEqual(36);
    expect(new Set(tier('medium').map((p) => p.motif))).toEqual(new Set(mediums));
    expect(new Set(tier('hero').map((p) => p.motif)).size).toBe(tier('hero').length);
    expect(new Set(tier('filler').map((p) => p.motif))).toEqual(new Set(FILLERS));
  });

  it('packs doodles close together without any touching, even across the edges', () => {
    let closest = Infinity;
    for (let i = 0; i < placements.length; i++) {
      const p = placements[i]!;
      for (let j = i + 1; j < placements.length; j++) {
        const q = placements[j]!;
        closest = Math.min(closest, wrappedDistance(p, q) - radius(p) - radius(q));
      }
    }
    expect(closest).toBeGreaterThanOrEqual(GAP - 0.2);
    expect(closest).toBeLessThan(GAP + 2);
  });

  it('leaves almost no empty background: no big hole anywhere on the tile', () => {
    // Every point on a 20px grid is within 26px of the edge of some doodle.
    let worst = 0;
    for (let y = 0; y < TILE_SIZE; y += 20) {
      for (let x = 0; x < TILE_SIZE; x += 20) {
        let nearest = Infinity;
        for (const p of placements)
          nearest = Math.min(nearest, wrappedDistance(p, { x, y }) - radius(p));
        worst = Math.max(worst, nearest);
      }
    }
    expect(worst).toBeLessThan(26);
  });

  it('keeps doodles upright or slightly tilted, in one thin even line weight', () => {
    for (const p of [...tier('hero'), ...tier('medium')]) {
      expect(Math.abs(p.rotate)).toBeLessThanOrEqual(25);
    }
    expect(new Set(tier('medium').map((p) => Math.round(p.rotate))).size).toBeGreaterThan(40);
    expect(STROKE).toBeLessThanOrEqual(1.6);
    const widths = [...tile.matchAll(/scale\(([\d.]+)\)" stroke-width="([\d.]+)"/g)];
    expect(widths.length).toBeGreaterThan(200);
    for (const [, scale, width] of widths) {
      expect(Number(scale) * Number(width)).toBeCloseTo(STROKE, 1);
    }
  });

  it('is lines only, with rounded ends and no fills', () => {
    expect(tile).toContain('fill="none"');
    expect(tile).toContain('stroke-linecap="round"');
    expect(tile).not.toMatch(/fill="(?!none)/);
  });

  it('has no rows or columns: never more than four doodles on one line across or down', () => {
    const big = [...tier('hero'), ...tier('medium')];
    for (const p of big) {
      const sameRow = big.filter((q) => q !== p && Math.abs(q.y - p.y) < 0.5).length;
      const sameColumn = big.filter((q) => q !== p && Math.abs(q.x - p.x) < 0.5).length;
      expect(sameRow).toBeLessThanOrEqual(4);
      expect(sameColumn).toBeLessThanOrEqual(4);
    }
  });

  it('draws a doodle again on the opposite side when it crosses an edge, so the seams never show', () => {
    const drawn = (tile.match(/<use /g) ?? []).length;
    const copies = placements.reduce((n, p) => {
      const r = reach(p);
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
    for (const prop of ['mask', '-webkit-mask']) {
      expect(css).toContain(
        `\n  ${prop}: url('./doodle-scatter.svg') 0 0 / ${TILE_SIZE}px ${TILE_SIZE}px repeat;`,
      );
    }
  });
});
