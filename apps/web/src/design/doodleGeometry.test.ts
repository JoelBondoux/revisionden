import { clearance, convexHull, footprintPoints, pathPoints } from './doodleGeometry';

// J8b: each doodle's real outline (its "footprint"), worked out from its SVG at build time, so
// the tile can keep every doodle a few pixels clear of every other: no overlaps at all.
const near = (a: number, b: number) => Math.abs(a - b) < 0.6;
const xs = (pts: { x: number; y: number }[]) => pts.map((p) => p.x);
const ys = (pts: { x: number; y: number }[]) => pts.map((p) => p.y);

describe('reading SVG path outlines', () => {
  it('follows lines, including relative and horizontal or vertical moves', () => {
    const pts = pathPoints('M0 0h10v10H0zm20 0l5 5L30 0');
    expect(pts).toContainEqual({ x: 10, y: 10 });
    expect(pts).toContainEqual({ x: 25, y: 5 });
    expect(pts).toContainEqual({ x: 30, y: 0 });
  });

  it('follows curves and arcs through their bulge, not just their ends', () => {
    const arc = pathPoints('M-10 0a10 10 0 0 1 20 0');
    expect(Math.min(...ys(arc))).toBeLessThan(-9);
    const curve = pathPoints('M0 0c0-10 10-10 10 0');
    expect(Math.min(...ys(curve))).toBeLessThan(-6);
    const smooth = pathPoints('M0 0c0-10 10-10 10 0s10 10 10 0');
    expect(Math.max(...ys(smooth))).toBeGreaterThan(6);
  });

  it('reads numbers written without spaces, like 1.5.5 and 3-2', () => {
    const pts = pathPoints('M0 0l1.5.5 3-2');
    expect(pts).toContainEqual({ x: 1.5, y: 0.5 });
    expect(pts).toContainEqual({ x: 4.5, y: -1.5 });
  });
});

describe('a motif footprint', () => {
  it('includes circles and ellipses at their full size', () => {
    const pts = footprintPoints('<circle cx="2" cy="3" r="5"/><ellipse cx="20" rx="4" ry="2"/>');
    expect(near(Math.min(...xs(pts)), -3)).toBe(true);
    expect(near(Math.max(...xs(pts)), 24)).toBe(true);
    expect(near(Math.max(...ys(pts)), 8)).toBe(true);
  });

  it('applies group and element transforms', () => {
    const pts = footprintPoints(
      '<g transform="translate(5 0) scale(2)"><path d="M0 0h1"/></g><path d="M0 0h10" transform="rotate(90)"/>',
    );
    expect(pts).toContainEqual({ x: 5, y: 0 });
    expect(pts).toContainEqual({ x: 7, y: 0 });
    expect(pts.some((p) => near(p.x, 0) && near(p.y, 10))).toBe(true);
  });
});

describe('outlines and gaps', () => {
  it('wraps points in their convex outline', () => {
    const hull = convexHull([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 5, y: 5 },
    ]);
    expect(hull).toHaveLength(4);
  });

  it('measures the gap between two outlines, and none when they touch or overlap', () => {
    const square = (x: number) => [
      { x, y: 0 },
      { x: x + 10, y: 0 },
      { x: x + 10, y: 10 },
      { x, y: 10 },
    ];
    expect(clearance(square(0), square(20))).toBeCloseTo(10);
    expect(clearance(square(0), square(10))).toBe(0);
    expect(clearance(square(0), square(5))).toBe(0);
    const diamond = [
      { x: 30, y: 5 },
      { x: 35, y: 0 },
      { x: 40, y: 5 },
      { x: 35, y: 10 },
    ];
    expect(clearance(square(0), diamond)).toBeCloseTo(20);
  });
});
