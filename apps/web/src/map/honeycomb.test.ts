import { honeycombRows } from './honeycomb';

describe('honeycombRows', () => {
  it('alternates wide and narrow rows so hexes interlock', () => {
    expect(honeycombRows([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([
      [1, 2, 3],
      [4, 5],
      [6, 7],
    ]);
  });

  it('keeps every item in order', () => {
    const items = Array.from({ length: 11 }, (_, i) => i);
    expect(honeycombRows(items, 3).flat()).toEqual(items);
  });

  it('returns no rows for no items', () => {
    expect(honeycombRows([], 3)).toEqual([]);
  });

  it('never makes a narrow row of zero when the wide row is one', () => {
    expect(honeycombRows(['a', 'b', 'c'], 1)).toEqual([['a'], ['b'], ['c']]);
  });
});
