import { PLAIN, outfitFor, touchFor } from './outfits';

// J15b (owner, 2026-11-26): Pip dresses lightly for the current subject, and a unisex touch rotates
// by day, never tied to the subject or the student.
describe("Pip's outfit", () => {
  it.each([
    ['gcse-maths', 'pencil', 'protractor'],
    ['a-level-physics', 'goggles', 'magnet'],
    ['gcse-chemistry', 'lab-collar', 'test-tube'],
    ['gcse-biology', 'leaf', 'magnifier'],
    ['gcse-english-literature', 'ruff', 'quill'],
    ['gcse-history', 'explorer-hat', 'scroll'],
    ['gcse-french', 'beret', 'croissant'],
    ['gcse-computer-science', 'headset', 'laptop'],
    ['gcse-drama', 'bow-tie', 'mask'],
    ['gcse-film-studies', 'round-glasses', 'clapperboard'],
  ])('dresses for %s with one worn item and one prop', (id, item, prop) => {
    expect(outfitFor(id)).toMatchObject({ item, prop });
  });

  it('also knows a subject by its name', () => {
    expect(outfitFor('English Literature').item).toBe('ruff');
  });

  it('is plain with no subject, or one it has no outfit for', () => {
    expect(outfitFor(null)).toBe(PLAIN);
    expect(outfitFor('gcse-astrology')).toBe(PLAIN);
  });
});

describe("Pip's unisex touch", () => {
  const days = Array.from({ length: 60 }, (_, i) =>
    new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10),
  );

  it('is the same all day and changes across days', () => {
    expect(touchFor('2026-11-26')).toBe(touchFor('2026-11-26'));
    expect(new Set(days.map((d) => touchFor(d))).size).toBe(4);
  });

  it('is neutral (no touch) on about half of days', () => {
    const plain = days.filter((d) => touchFor(d) === 'none').length;
    expect(plain).toBeGreaterThan(15);
    expect(plain).toBeLessThan(45);
  });

  it('never depends on the subject', () => {
    // It takes only the day and an optional seed: there is no way to pass a subject or a student.
    expect(touchFor.length).toBe(1);
  });
});
