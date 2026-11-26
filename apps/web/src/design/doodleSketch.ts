/**
 * J8c: the background doodles redrawn as if sketched in a notebook (owner decision 2026-11-26,
 * chosen over the crisp version). Generic hand-drawn techniques only, no particular book's look:
 * wobbly lines, strokes that overshoot at the corners, the odd double stroke and a little
 * scribble shading. All baked into the paths at build time from a fixed seed: no filters, no
 * runtime cost. The tiny fillers stay crisp. The shipped tile (doodle-scatter.svg) is placed and
 * drawn with these motifs, so its no-overlap rule uses the hand-drawn outlines.
 */
import { FILLERS, MOTIFS, seededRandom } from './doodleTile';
import { convexHull, motifPolylines, type Point } from './doodleGeometry';

const STEP = 4;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Points every STEP units along a line, keeping its corners. */
function resample(line: readonly Point[]): Point[] {
  const out: Point[] = [line[0]!];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / STEP));
    for (let k = 1; k <= n; k++)
      out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  return out;
}

/** Splits a line where it turns sharply, so each piece can overshoot its corner. */
function splitAtCorners(line: readonly Point[]): Point[][] {
  const pieces: Point[][] = [];
  let piece: Point[] = [line[0]!];
  for (let i = 1; i < line.length - 1; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    const c = line[i + 1]!;
    piece.push(b);
    const turn = Math.abs(
      Math.atan2(
        (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x),
        (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y),
      ),
    );
    if (turn > 0.9) {
      pieces.push(piece);
      piece = [b];
    }
  }
  piece.push(line.at(-1)!);
  pieces.push(piece);
  return pieces.filter((p) => p.length > 1);
}

const lengthOf = (line: readonly Point[]) =>
  line.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - line[i]!.x, p.y - line[i]!.y), 0);

/** One hand-drawn stroke: ends overshoot a little and the line wobbles gently. */
function wobble(piece: readonly Point[], random: () => number, offset = 0): Point[] {
  const pts = resample(piece);
  const first = pts[0]!;
  const second = pts[1]!;
  const last = pts.at(-1)!;
  const before = pts.at(-2)!;
  const ext = (from: Point, to: Point, by: number) => {
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return { x: to.x + ((to.x - from.x) / len) * by, y: to.y + ((to.y - from.y) / len) * by };
  };
  if (lengthOf(piece) > 3) {
    pts[0] = ext(second, first, 0.6 + random() * 0.9);
    pts[pts.length - 1] = ext(before, last, 0.6 + random() * 0.9);
  }
  const phase = random() * Math.PI * 2;
  const amp = 0.25 + random() * 0.25;
  return pts.map((p, i) => {
    const q = pts[Math.min(pts.length - 1, i + 1)]!;
    const o = pts[Math.max(0, i - 1)]!;
    const len = Math.hypot(q.x - o.x, q.y - o.y) || 1;
    const [nx, ny] = [-(q.y - o.y) / len, (q.x - o.x) / len];
    const d = amp * Math.sin(i * 0.9 + phase) + (random() - 0.5) * 0.3 + offset;
    return { x: p.x + nx * d, y: p.y + ny * d };
  });
}

/** A smooth path through points, in short relative steps. */
function smoothPath(pts: readonly Point[]): string {
  let [x, y] = [r1(pts[0]!.x), r1(pts[0]!.y)];
  let d = `M${x} ${y}l`;
  for (let i = 1; i < pts.length; i++) {
    const [nx, ny] = [r1(pts[i]!.x), r1(pts[i]!.y)];
    d += `${r1(nx - x)} ${r1(ny - y)} `;
    [x, y] = [nx, ny];
  }
  return d
    .trim()
    .replace(/ -/g, '-')
    .replace(/(^|[^\d])0\./g, '$1.');
}

/** Scribbled shading inside a closed, roughly convex shape: one zigzag of diagonal strokes. */
function scribble(loop: readonly Point[], random: () => number): string | null {
  const hull = convexHull(loop);
  const area = (poly: readonly Point[]) =>
    Math.abs(
      poly.reduce((n, p, i) => {
        const q = poly[(i + 1) % poly.length]!;
        return n + p.x * q.y - q.x * p.y;
      }, 0) / 2,
    );
  if (area(hull) < 50 || area(loop) / area(hull) < 0.85) return null;
  const cx = hull.reduce((n, p) => n + p.x, 0) / hull.length;
  const cy = hull.reduce((n, p) => n + p.y, 0) / hull.length;
  const inner = hull.map((p) => ({ x: cx + (p.x - cx) * 0.72, y: cy + (p.y - cy) * 0.72 }));
  const angle = random() < 0.5 ? Math.PI / 4 : -Math.PI / 5;
  const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
  const [vx, vy] = [-uy, ux];
  const along = inner.map((p) => p.x * vx + p.y * vy);
  const zig: Point[] = [];
  let flip = false;
  for (let t = Math.min(...along) + 1.2; t < Math.max(...along) - 0.6; t += 2.4) {
    const hits: number[] = [];
    for (let i = 0; i < inner.length; i++) {
      const a = inner[i]!;
      const b = inner[(i + 1) % inner.length]!;
      const ta = a.x * vx + a.y * vy;
      const tb = b.x * vx + b.y * vy;
      if ((ta - t) * (tb - t) <= 0 && ta !== tb) {
        const k = (t - ta) / (tb - ta);
        hits.push((a.x + (b.x - a.x) * k) * ux + (a.y + (b.y - a.y) * k) * uy);
      }
    }
    if (hits.length < 2) continue;
    const [s0, s1] = [Math.min(...hits), Math.max(...hits)];
    const ends = flip ? [s1, s0] : [s0, s1];
    for (const s of ends) zig.push({ x: s * ux + t * vx, y: s * uy + t * vy });
    flip = !flip;
  }
  return zig.length >= 4 ? smoothPath(zig) : null;
}

/** A motif redrawn by hand: same shape, sketchy lines, sometimes a scribbled fill. */
export function sketchMotif(markup: string, random: () => number): string {
  const strokes: string[] = [];
  let shade: string | null = null;
  for (const line of motifPolylines(markup)) {
    const closed =
      line.length > 3 && Math.hypot(line[0]!.x - line.at(-1)!.x, line[0]!.y - line.at(-1)!.y) < 0.5;
    for (const piece of splitAtCorners(line)) {
      strokes.push(smoothPath(wobble(piece, random)));
      if (lengthOf(piece) > 8 && random() < 0.18) {
        strokes.push(smoothPath(wobble(piece, random, 0.55)));
      }
    }
    if (closed && !shade && random() < 0.3) shade = scribble(line, random);
  }
  return `<path d="${strokes.join('')}"/>${shade ? `<path d="${shade}" stroke-opacity=".5"/>` : ''}`;
}

/** Every motif redrawn by hand, from a fixed seed. */
export function sketchMotifs(seed = 7): Record<string, string> {
  const random = seededRandom(seed);
  return Object.fromEntries(
    Object.entries(MOTIFS).map(([name, markup]) => [
      name,
      FILLERS.includes(name) ? markup : sketchMotif(markup, random),
    ]),
  );
}

/** The hand-drawn motifs the shipped tile uses. */
export const SKETCH_MOTIFS: Readonly<Record<string, string>> = sketchMotifs();
