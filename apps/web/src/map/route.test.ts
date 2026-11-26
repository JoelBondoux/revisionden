import { layoutRoute, routeShapes, segmentPath, type RouteItem } from './route';

const main = (key: string): RouteItem => ({ key, kind: 'main' });
const topics = ['a', 'b', 'c', 'd', 'e', 'f'].map(main);

// J15c (owner sign-off of the all-themes mockup, revision 5, 2026-11-26): each unit gets its own
// readable route from a seed (subject + unit), climbing from the first topic at the bottom to the
// unit quest at the top, with an optional Higher side branch, either-order pairs and bridges.
describe('the route through a unit', () => {
  it('is the same every time for the same subject and unit, and differs between units', () => {
    const one = layoutRoute({ seed: 'gcse-maths:number', items: topics });
    expect(layoutRoute({ seed: 'gcse-maths:number', items: topics })).toEqual(one);
    const xs = (seed: string) =>
      layoutRoute({ seed, items: topics })
        .points.map((p) => p.x.toFixed(1))
        .join();
    const shapes = new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'].map(xs));
    expect(shapes.size).toBeGreaterThan(4);
  });

  it('uses every kind of shape across units: S-bends, switchbacks, a long sweep and a curl', () => {
    const seen = new Set(
      Array.from({ length: 40 }, (_, i) => layoutRoute({ seed: `s:${i}`, items: topics }).shape),
    );
    expect([...seen].sort()).toEqual([...routeShapes].sort());
  });

  it('climbs from the first topic at the bottom to the unit quest at the top', () => {
    const route = layoutRoute({ seed: 'x', items: topics });
    const ys = route.points.filter((p) => p.kind === 'main').map((p) => p.y);
    expect(ys).toEqual([...ys].sort((p, q) => q - p));
    const quest = route.points.find((p) => p.kind === 'quest')!;
    expect(quest.y).toBeLessThan(Math.min(...ys));
    expect(route.height).toBeGreaterThan(Math.max(...ys));
  });

  it('keeps every node on screen and well apart', () => {
    for (let i = 0; i < 30; i++) {
      const { points } = layoutRoute({ seed: `gap:${i}`, items: topics });
      for (const p of points) {
        expect(p.x).toBeGreaterThanOrEqual(14);
        expect(p.x).toBeLessThanOrEqual(86);
      }
      for (const p of points)
        for (const q of points)
          if (p !== q) expect(Math.hypot((p.x - q.x) * 3, p.y - q.y)).toBeGreaterThan(70);
    }
  });

  it('forks an optional Higher branch off the route and rejoins it, on the other side', () => {
    const items = [
      main('a'),
      main('b'),
      { key: 'h1', kind: 'higher' as const },
      { key: 'h2', kind: 'higher' as const },
      main('c'),
    ];
    const route = layoutRoute({ seed: 'h', items });
    const at = (key: string) => route.points.find((p) => p.key === key)!;
    expect(at('b').x).toBeLessThan(50);
    expect(at('c').x).toBeLessThan(50);
    expect(at('h1').x).toBeGreaterThan(50);
    const branch = route.segments
      .filter((s) => s.kind === 'branch')
      .map((s) => `${s.from}>${s.to}`);
    expect(branch).toEqual(['b>h1', 'h1>h2', 'h2>c']);
    // The main route goes straight from b to c past the branch.
    expect(route.segments.some((s) => s.kind === 'main' && s.from === 'b' && s.to === 'c')).toBe(
      true,
    );
  });

  it('copes with a Higher branch at the start or the end of a unit (Codex review of #307)', () => {
    const h = (key: string) => ({ key, kind: 'higher' as const });
    const first = layoutRoute({ seed: 'h0', items: [h('h1'), main('a'), main('b')] });
    expect(first.points.map((p) => p.key)).toEqual(expect.arrayContaining(['h1', 'a', 'b']));
    expect(
      first.segments.filter((s) => s.kind === 'branch').map((s) => `${s.from}>${s.to}`),
    ).toEqual(['h1>a']);
    const last = layoutRoute({ seed: 'h9', items: [main('a'), main('b'), h('h1')] });
    // At the end, the branch rejoins at the unit challenge.
    expect(
      last.segments.filter((s) => s.kind === 'branch').map((s) => `${s.from}>${s.to}`),
    ).toEqual(['b>h1', 'h1>quest']);
    expect(layoutRoute({ seed: 'hh', items: [h('h1'), h('h2')] }).points).toHaveLength(3);
  });

  it('splits around two topics that can be done in either order, then rejoins', () => {
    const items = [
      main('a'),
      { key: 'e1', kind: 'either' as const, group: 'g' },
      { key: 'e2', kind: 'either' as const, group: 'g' },
      main('b'),
    ];
    const route = layoutRoute({ seed: 'e', items });
    const at = (key: string) => route.points.find((p) => p.key === key)!;
    expect(at('e1').y).toBe(at('e2').y);
    expect(Math.abs(at('e1').x - at('e2').x)).toBeGreaterThan(40);
    const pairs = route.segments.map((s) => `${s.from}>${s.to}`);
    expect(pairs).toEqual(expect.arrayContaining(['a>e1', 'a>e2', 'e1>b', 'e2>b']));
  });

  it('makes room above a topic for its bridges, in a column of their own', () => {
    const plain = layoutRoute({ seed: 'b', items: topics });
    const route = layoutRoute({ seed: 'b', items: topics, bridges: { c: 2 } });
    expect(route.height).toBe(plain.height + 2 * 80);
    const bridges = route.points.filter((p) => p.kind === 'bridge');
    expect(bridges.map((p) => p.key)).toEqual(['c#0', 'c#1']);
    const c = route.points.find((p) => p.key === 'c')!;
    expect(bridges.every((p) => p.x > 60 && p.y < c.y)).toBe(true);
    expect(
      route.segments.filter((s) => s.kind === 'bridge').map((s) => `${s.from}>${s.to}`),
    ).toEqual(['c>c#0', 'c#0>c#1']);
  });
});

describe('a road segment', () => {
  it('leaves and arrives vertically, and follows a node as it drifts', () => {
    const a = { x: 30, y: 300, dx: 0, dy: 0 };
    const b = { x: 70, y: 200, dx: 0, dy: 0 };
    expect(segmentPath(a, b, { width: 300 })).toBe('M 30 300 C 30 250 70 250 70 200');
    expect(segmentPath({ ...a, dx: 3 }, b, { width: 300 })).toBe('M 31 300 C 31 250 70 250 70 200');
  });

  it('grows out from its start while a bridge is being discovered', () => {
    const a = { x: 30, y: 300, dx: 0, dy: 0 };
    const b = { x: 70, y: 260, dx: 0, dy: 0 };
    expect(segmentPath(a, b, { width: 300, side: true, grow: 0 })).toBe(
      'M 30 300 C 30 300 30 300 30 300',
    );
  });
});
