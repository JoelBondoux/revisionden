import { rowScrollTarget } from './hscroll';

// J12d (owner, 2026-11-26): the subject row opened scrolled so the chip on the left was cut
// mid-word ("re (coming soon)"). The row now moves only as far as it must to show the chosen chip
// whole, and lines up on a chip's edge, so the first chip you see is always whole.
const chips = (...widths: number[]) => {
  let x = 0;
  return widths.map((w) => {
    const item = { start: x, end: x + w };
    x += w + 8;
    return item;
  });
};

describe('where a sideways row scrolls to show the chosen item', () => {
  const view = { width: 300, pad: 4, current: 0 };

  it('stays at the start when the chosen item already fits', () => {
    const items = chips(100, 100, 300);
    expect(rowScrollTarget(items, 1, { ...view, max: 220 }).left).toBe(0);
  });

  it('scrolls just far enough, lining up on a whole item', () => {
    // 0–180, 188–308, 316–416, 424–574: showing the third needs the row to start at the second.
    const items = chips(180, 120, 100, 150);
    const { left: target } = rowScrollTarget(items, 2, { ...view, max: 278 });
    expect(target).toBe(188 - 4);
    expect(items[2]!.end - target).toBeLessThanOrEqual(300);
  });

  it('never cuts the first visible item, even when it is wide', () => {
    const items = chips(260, 120, 120, 200);
    const { left: target } = rowScrollTarget(items, 2, { ...view, max: 432 });
    // Starting at the second item shows both narrow chips whole.
    expect(target).toBe(268 - 4);
  });

  it('never scrolls before the start', () => {
    const items = chips(200, 200, 60);
    expect(rowScrollTarget(items, 0, { ...view, current: 150, max: 180 })).toEqual({
      left: 0,
      extraEnd: 0,
    });
  });

  it('adds a little space after the last item so the row can stop on a whole one', () => {
    // 0–200, 208–408, 416–476, 484–584: the third fits from the second item's edge (204), just
    // past the end of the row (184), so 20px is added after the last item.
    const items = chips(200, 200, 60, 100);
    expect(rowScrollTarget(items, 2, { ...view, max: 184 })).toEqual({ left: 204, extraEnd: 20 });
  });

  it('stops at the end instead when that would need a lot of blank space', () => {
    // 0–250, 258–508, 516–556: lining up on the last item would leave 252px blank.
    const items = chips(250, 250, 40);
    expect(rowScrollTarget(items, 2, { ...view, max: 260 })).toEqual({ left: 260, extraEnd: 0 });
  });

  it('leaves the row alone when the item is already in full view', () => {
    const items = chips(100, 100, 100, 100);
    expect(rowScrollTarget(items, 2, { ...view, current: 108, max: 116 }).left).toBe(108);
  });

  it('brings an item that is off the left edge in, lined up on its own edge', () => {
    const items = chips(100, 100, 100, 100);
    expect(rowScrollTarget(items, 1, { ...view, current: 116, max: 116 }).left).toBe(108 - 4);
  });
});
