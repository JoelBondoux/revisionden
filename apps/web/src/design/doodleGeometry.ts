/**
 * J8b: the real outline ("footprint") of a doodle motif, worked out from its SVG markup at build
 * time. Reads the few SVG features the motifs use (path commands, circles, ellipses and
 * translate/scale/rotate transforms), samples curves and arcs, and wraps the points in a convex
 * outline. `clearance` measures the gap between two outlines, so the tile generator can keep
 * every doodle a few pixels clear of every other.
 */
export interface Point {
  x: number;
  y: number;
}

type Matrix = readonly [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const apply = (m: Matrix, p: Point): Point => ({
  x: m[0] * p.x + m[2] * p.y + m[4],
  y: m[1] * p.x + m[3] * p.y + m[5],
});

const numbers = (text: string): number[] =>
  (text.match(/-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/gi) ?? []).map(Number);

/** A transform attribute as a matrix (translate, scale and rotate, in any order). */
export function parseTransform(text: string | undefined): Matrix {
  let m = IDENTITY;
  for (const [, name, args] of (text ?? '').matchAll(/(\w+)\(([^)]*)\)/g)) {
    const a = numbers(args!);
    if (name === 'translate') m = multiply(m, [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]);
    if (name === 'scale') m = multiply(m, [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]);
    if (name === 'rotate') {
      const r = ((a[0] ?? 0) * Math.PI) / 180;
      const [cx, cy] = [a[1] ?? 0, a[2] ?? 0];
      m = multiply(m, [1, 0, 0, 1, cx, cy]);
      m = multiply(m, [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
      m = multiply(m, [1, 0, 0, 1, -cx, -cy]);
    }
  }
  return m;
}

/** Points along an elliptical arc (SVG endpoint form), endpoints excluded. */
function arcPoints(from: Point, a: number[], to: Point): Point[] {
  let [rx, ry] = [Math.abs(a[0]!), Math.abs(a[1]!)];
  const phi = (a[2]! * Math.PI) / 180;
  const [large, sweep] = [a[3]! !== 0, a[4]! !== 0];
  if (rx === 0 || ry === 0) return [];
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cx1 = (k * rx * y1) / ry;
  const cy1 = (-k * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from.x + to.x) / 2;
  const cy = sin * cx1 + cos * cy1 + (from.y + to.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) =>
    Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const start = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const out: Point[] = [];
  for (let i = 1; i < 12; i++) {
    const t = start + (delta * i) / 12;
    const [ex, ey] = [rx * Math.cos(t), ry * Math.sin(t)];
    out.push({ x: cos * ex - sin * ey + cx, y: sin * ex + cos * ey + cy });
  }
  return out;
}

const cubic = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};

/** The points an SVG path passes through, with curves and arcs sampled along their length. */
export function pathPoints(d: string): Point[] {
  return pathPolylines(d).flat();
}

/** Like pathPoints, but one list of points per stroke (each move-to starts a new one). */
export function pathPolylines(d: string): Point[][] {
  const lines: Point[][] = [];
  let out: Point[] = [];
  let cur: Point = { x: 0, y: 0 };
  let start: Point = cur;
  let lastControl: Point | null = null;
  for (const [, cmd, args] of d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g)) {
    const a = numbers(args!);
    const rel = cmd === cmd!.toLowerCase();
    const at = (x: number, y: number): Point => (rel ? { x: cur.x + x, y: cur.y + y } : { x, y });
    const upper = cmd!.toUpperCase();
    if (upper === 'Z') {
      cur = start;
      out.push(cur);
      lastControl = null;
      continue;
    }
    const size = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }[upper]!;
    for (let i = 0; i + size <= a.length; i += size) {
      const v = a.slice(i, i + size);
      if (upper === 'M' || upper === 'L' || upper === 'T') {
        cur = at(v[0]!, v[1]!);
        if (upper === 'M' && i === 0) {
          start = cur;
          out = [];
          lines.push(out);
        }
        lastControl = null;
      } else if (upper === 'H') {
        cur = { x: rel ? cur.x + v[0]! : v[0]!, y: cur.y };
      } else if (upper === 'V') {
        cur = { x: cur.x, y: rel ? cur.y + v[0]! : v[0]! };
      } else if (upper === 'C' || upper === 'S') {
        const c1 =
          upper === 'C'
            ? at(v[0]!, v[1]!)
            : lastControl
              ? { x: 2 * cur.x - lastControl.x, y: 2 * cur.y - lastControl.y }
              : cur;
        const c2 = upper === 'C' ? at(v[2]!, v[3]!) : at(v[0]!, v[1]!);
        const end = upper === 'C' ? at(v[4]!, v[5]!) : at(v[2]!, v[3]!);
        for (let k = 1; k < 8; k++) out.push(cubic(cur, c1, c2, end, k / 8));
        lastControl = c2;
        cur = end;
      } else if (upper === 'Q') {
        const c = at(v[0]!, v[1]!);
        const end = at(v[2]!, v[3]!);
        for (let k = 1; k < 8; k++) {
          const t = k / 8;
          const u = 1 - t;
          out.push({
            x: u * u * cur.x + 2 * u * t * c.x + t * t * end.x,
            y: u * u * cur.y + 2 * u * t * c.y + t * t * end.y,
          });
        }
        cur = end;
      } else if (upper === 'A') {
        const end = at(v[5]!, v[6]!);
        out.push(...arcPoints(cur, v, end));
        cur = end;
        lastControl = null;
      }
      if (upper !== 'C' && upper !== 'S') lastControl = null;
      out.push(cur);
    }
  }
  return lines.filter((l) => l.length > 0);
}

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

const ring = (cx: number, cy: number, rx: number, ry: number): Point[] =>
  Array.from({ length: 16 }, (_, i) => {
    const t = (i / 16) * Math.PI * 2;
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  });

/** Every point a motif's markup draws through, in the motif's own units. */
export function footprintPoints(markup: string): Point[] {
  const out: Point[] = [];
  const stack: Matrix[] = [IDENTITY];
  for (const [tag, close, name] of markup.matchAll(/<(\/?)(g|path|circle|ellipse)\b[^>]*>/g)) {
    if (close) {
      stack.pop();
      continue;
    }
    const m = multiply(stack.at(-1)!, parseTransform(attr(tag, 'transform')));
    if (name === 'g') {
      if (!tag.endsWith('/>')) stack.push(m);
      continue;
    }
    const num = (n: string) => Number(attr(tag, n) ?? 0);
    const local =
      name === 'path'
        ? pathPoints(attr(tag, 'd') ?? '')
        : name === 'circle'
          ? ring(num('cx'), num('cy'), num('r'), num('r'))
          : ring(num('cx'), num('cy'), num('rx'), num('ry'));
    for (const p of local) out.push(apply(m, p));
  }
  return out;
}

/** The convex outline round some points (Andrew's monotone chain), anticlockwise. */
export function convexHull(points: readonly Point[]): Point[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function segmentDistance(p: Point, a: Point, b: Point): number {
  const [dx, dy] = [b.x - a.x, b.y - a.y];
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** True when two convex outlines overlap or touch (separating axis test). */
function overlaps(a: readonly Point[], b: readonly Point[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!;
      const q = poly[(i + 1) % poly.length]!;
      const [nx, ny] = [q.y - p.y, p.x - q.x];
      const project = (s: readonly Point[]) => s.map((v) => v.x * nx + v.y * ny);
      const pa = project(a);
      const pb = project(b);
      if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
    }
  }
  return true;
}

/** The gap between two convex outlines: 0 when they touch or overlap. */
export function clearance(a: readonly Point[], b: readonly Point[]): number {
  if (overlaps(a, b)) return 0;
  let best = Infinity;
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const) {
    for (const p of from) {
      for (let i = 0; i < to.length; i++) {
        best = Math.min(best, segmentDistance(p, to[i]!, to[(i + 1) % to.length]!));
      }
    }
  }
  return best;
}

/** Every stroke a motif's markup draws, in the motif's own units (circles as closed loops). */
export function motifPolylines(markup: string): Point[][] {
  const out: Point[][] = [];
  const stack: Matrix[] = [IDENTITY];
  for (const [tag, close, name] of markup.matchAll(/<(\/?)(g|path|circle|ellipse)\b[^>]*>/g)) {
    if (close) {
      stack.pop();
      continue;
    }
    const m = multiply(stack.at(-1)!, parseTransform(attr(tag, 'transform')));
    if (name === 'g') {
      if (!tag.endsWith('/>')) stack.push(m);
      continue;
    }
    const num = (n: string) => Number(attr(tag, n) ?? 0);
    const loop = (pts: Point[]) => [...pts, pts[0]!];
    const local =
      name === 'path'
        ? pathPolylines(attr(tag, 'd') ?? '')
        : name === 'circle'
          ? [loop(ring(num('cx'), num('cy'), num('r'), num('r')))]
          : [loop(ring(num('cx'), num('cy'), num('rx'), num('ry')))];
    for (const line of local) out.push(line.map((p) => apply(m, p)));
  }
  return out;
}
