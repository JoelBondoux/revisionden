/**
 * The route through a unit (J15c, from the owner-approved all-themes mockup, revision 5).
 *
 * Pure layout, no DOM: every unit gets its own readable shape from a seed (subject + unit), so a
 * student always sees the same route for the same unit. It climbs from the first topic at the
 * bottom to the unit quest at the top. A Foundation student's Higher-only topics sit on an optional
 * side branch that forks off and rejoins; two topics that may be done in either order sit side by
 * side; topics with discovered bridges get a column of bridge nodes in extra space above them.
 *
 * Units: x is a percentage of the trail's width (14 to 86), y is pixels from the trail's top.
 */

/** Vertical distance between rows. */
export const ROW_GAP = 112;
/** Extra height above a topic for each of its bridges. */
export const BRIDGE_GAP = 80;

export const routeShapes = ['S-bends', 'switchbacks', 'a long sweep', 'a curl'] as const;
export type RouteShape = (typeof routeShapes)[number];

export type RouteItem =
  | { key: string; kind: 'main' }
  | { key: string; kind: 'higher' }
  | { key: string; kind: 'either'; group: string };

export interface RoutePoint {
  key: string;
  kind: 'main' | 'higher' | 'either' | 'quest' | 'bridge';
  x: number;
  y: number;
}

export interface RouteSegment {
  from: string;
  to: string;
  kind: 'main' | 'branch' | 'bridge';
  /** Sideways push of the control points, for the curl. */
  curl?: number;
}

export interface Route {
  shape: RouteShape;
  height: number;
  points: RoutePoint[];
  segments: RouteSegment[];
}

export const QUEST_KEY = 'quest';

/** A small seeded random number generator (FNV-1a hash, then a mixing step). */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

interface Row {
  points: { key: string; kind: RoutePoint['kind']; x: number }[];
}

export function layoutRoute({
  seed,
  items,
  bridges = {},
}: {
  seed: string;
  /** Topics in specification order (bottom to top), without the quest. */
  items: readonly RouteItem[];
  /** How many bridges each topic has discovered (by topic key). */
  bridges?: Readonly<Record<string, number>>;
}): Route {
  const random = seeded(seed);
  const shape = routeShapes[Math.floor(random() * routeShapes.length)]!;
  const freq = 0.8 + random() * 0.6;
  const phase = random() * Math.PI * 2;
  const side = random() < 0.5 ? -1 : 1;

  // Rows, bottom to top: one node, or an either-order pair.
  const rows: Row[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (item.kind === 'either') {
      const pair = items
        .slice(i, i + 2)
        .filter((it) => it.kind === 'either' && it.group === item.group);
      rows.push({ points: pair.map((it, k) => ({ key: it.key, kind: 'either', x: k ? 76 : 24 })) });
      i += pair.length - 1;
    } else rows.push({ points: [{ key: item.key, kind: item.kind, x: 50 }] });
  }
  rows.push({ points: [{ key: QUEST_KEY, kind: 'quest', x: 50 }] });

  const n = rows.length;
  const lane = (i: number) => {
    if (shape === 'switchbacks') return i % 2 ? 72 - random() * 6 : 28 + random() * 6;
    if (shape === 'a long sweep')
      return 50 + side * 27 * Math.sin((Math.PI * i) / Math.max(1, n - 1));
    return 50 + 26 * Math.sin(i * freq + phase);
  };
  rows.forEach((row, i) => {
    const p = row.points[0]!;
    if (row.points.length === 1 && p.kind === 'main') p.x = Math.max(24, Math.min(76, lane(i)));
  });
  const single = (row: Row | undefined) =>
    row && row.points.length === 1 ? row.points[0] : undefined;
  const isHigher = (row: Row | undefined) => row?.points[0]?.kind === 'higher';
  // A Higher branch sits on the right; the route past it hugs the left.
  rows.forEach((row, i) => {
    if (!isHigher(row)) return;
    row.points[0]!.x = 72;
    const before = rows
      .slice(0, i)
      .reverse()
      .find((r) => !isHigher(r));
    const after = rows.slice(i).find((r) => !isHigher(r));
    for (const r of [before, after]) {
      const p = single(r);
      if (p && p.kind !== 'quest') p.x = 30;
    }
  });
  // The rows either side of an either-order pair sit in the middle, so the split is even.
  rows.forEach((row, i) => {
    if (row.points.length !== 2) return;
    for (const r of [rows[i - 1], rows[i + 1]]) {
      const p = single(r);
      if (p && p.kind === 'main') p.x = 50;
    }
  });
  // A topic with bridges keeps to the left with the next row, and its bridges climb on the right.
  const extra = rows.map((row) => {
    const p = single(row);
    return p && p.kind === 'main' ? (bridges[p.key] ?? 0) : 0;
  });
  rows.forEach((row, i) => {
    if (!extra[i]) return;
    row.points[0]!.x = 30;
    const next = rows.slice(i + 1).find((r) => !isHigher(r));
    const p = single(next);
    if (p && p.kind === 'main') p.x = 30;
  });

  const lift = extra.map((_, i) => extra.slice(0, i).reduce((a, b) => a + b, 0) * BRIDGE_GAP);
  const height = n * ROW_GAP + 90 + extra.reduce((a, b) => a + b, 0) * BRIDGE_GAP;
  const points: RoutePoint[] = [];
  rows.forEach((row, i) => {
    for (const p of row.points)
      points.push({ key: p.key, kind: p.kind, x: p.x, y: height - 60 - i * ROW_GAP - lift[i]! });
  });

  const segments: RouteSegment[] = [];
  const mainRows = rows.filter((r) => !isHigher(r));
  for (let m = 1; m < mainRows.length; m++) {
    for (const a of mainRows[m - 1]!.points)
      for (const b of mainRows[m]!.points) segments.push({ from: a.key, to: b.key, kind: 'main' });
  }
  // A branch forks off the row before it and rejoins the row after it; at the start or end of a
  // unit there is nothing to fork from or rejoin, so that end is simply open.
  rows.forEach((row, i) => {
    if (!isHigher(row)) return;
    const before = rows[i - 1];
    const after = rows[i + 1];
    if (before)
      segments.push({ from: before.points[0]!.key, to: row.points[0]!.key, kind: 'branch' });
    if (after && !isHigher(after))
      segments.push({ from: row.points[0]!.key, to: after.points[0]!.key, kind: 'branch' });
  });
  if (shape === 'a curl') {
    const at = (key: string) => points.find((p) => p.key === key)!;
    const seg = segments.find(
      (s, j) =>
        s.kind === 'main' && j >= 1 && at(s.from).kind === 'main' && at(s.to).kind === 'main',
    );
    if (seg) seg.curl = at(seg.from).x < 50 ? 34 : -34;
  }
  // Bridges: a column on the right, climbing into the space made for them.
  rows.forEach((row, i) => {
    if (!extra[i]) return;
    const source = points.find((p) => p.key === row.points[0]!.key)!;
    let from = source.key;
    for (let k = 0; k < extra[i]!; k++) {
      const key = `${source.key}#${k}`;
      points.push({ key, kind: 'bridge', x: 72, y: source.y - 46 - k * BRIDGE_GAP });
      segments.push({ from, to: key, kind: 'bridge' });
      from = key;
    }
  });
  return { shape, height, points, segments };
}

const num = (n: number) => String(Number(n.toFixed(2)));

/**
 * One road segment as an SVG path, in trail units (x in %, y in px). Each end can drift (dx, dy in
 * px, for the breathing path); `grow` draws a bridge's connector in from its start.
 */
export function segmentPath(
  a: { x: number; y: number; dx: number; dy: number },
  b: { x: number; y: number; dx: number; dy: number },
  {
    width,
    curl = 0,
    side = false,
    grow = 1,
  }: { width: number; curl?: number; side?: boolean; grow?: number },
): string {
  const ax = a.x + (a.dx / width) * 100;
  const ay = a.y + a.dy;
  const tx = b.x + (b.dx / width) * 100;
  const ty = b.y + b.dy;
  const bx = ax + (tx - ax) * grow;
  const by = ay + (ty - ay) * grow;
  if (side)
    return `M ${num(ax)} ${num(ay)} C ${num((ax + bx) / 2)} ${num(ay)} ${num(bx)} ${num((ay + by) / 2)} ${num(bx)} ${num(by)}`;
  const k = (ay - by) / 2;
  return `M ${num(ax)} ${num(ay)} C ${num(ax + curl)} ${num(ay - k)} ${num(bx + curl)} ${num(by + k)} ${num(bx)} ${num(by)}`;
}
