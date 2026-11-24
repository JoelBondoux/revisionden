/**
 * Splits items into honeycomb rows: a wide row, then a row one shorter, and so on. Centred rows
 * of alternating length interlock like a honeycomb, whatever the screen width.
 */
export function honeycombRows<T>(items: readonly T[], wide: number): T[][] {
  const narrow = Math.max(wide - 1, 1);
  const rows: T[][] = [];
  let i = 0;
  while (i < items.length) {
    const size = rows.length % 2 === 0 ? wide : narrow;
    rows.push(items.slice(i, i + size));
    i += size;
  }
  return rows;
}
