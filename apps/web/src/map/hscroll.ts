/** An item's left and right edges, measured from the start of the row's content. */
export interface RowItem {
  start: number;
  end: number;
}

interface RowView {
  /** The visible width of the row. */
  width: number;
  /** Space kept before the first visible item (the row's scroll padding). */
  pad: number;
  /** How far the row is scrolled now. */
  current: number;
  /** The furthest the row can scroll. */
  max: number;
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, Math.round(value)));

/** Where to scroll, and any space to add after the last item so the row can stop there. */
export interface RowScroll {
  left: number;
  extraEnd: number;
}

/** The most blank space ever added after the last item, as a share of the row's width. */
const MAX_EXTRA_SHARE = 0.4;

/**
 * Where a sideways row should scroll so the chosen item is in full view (J12d). It moves only as
 * far as it must, and always lines up on an item's edge, so the first item you see is whole,
 * never cut mid-word. Near the end of the row that can need a little blank space after the last
 * item (at most 40% of the row); past that it stops at the end instead.
 */
export function rowScrollTarget(
  items: readonly RowItem[],
  chosen: number,
  view: RowView,
): RowScroll {
  const item = items[chosen];
  const at = (left: number): RowScroll => {
    const wanted = Math.max(0, Math.round(left));
    const extraEnd = Math.max(0, wanted - view.max);
    if (extraEnd > view.width * MAX_EXTRA_SHARE)
      return { left: clamp(wanted, view.max), extraEnd: 0 };
    return { left: wanted, extraEnd };
  };
  if (!item) return { left: view.current, extraEnd: 0 };
  const { width, pad, current } = view;
  if (item.start - pad >= current && item.end <= current + width) {
    // In view. If an item is cut at the left edge, step on to the next whole one.
    const cut = items.some((i) => i.start < current - 0.5 && i.end > current + 0.5);
    if (!cut) return { left: current, extraEnd: 0 };
    const next = items.find((i) => i.start >= current - 0.5)!;
    return at(next.start - pad);
  }
  if (item.start - pad < current) return at(item.start - pad);
  for (const first of items.slice(0, chosen + 1)) {
    if (item.end - (first.start - pad) <= width) return at(first.start - pad);
  }
  return at(item.start - pad);
}
