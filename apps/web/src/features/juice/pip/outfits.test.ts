import { LOOK_FAMILIES, PLAIN, lookFor, outfitFor } from './outfits';

// J15b-2 (owner sign-off of the all-themes mockup, 2026-11-26): Pip dresses for every subject with
// a worn item and a prop that reads at button size; the language subjects add a soft flag wash; a
// gently-leaning look rotates by day, never tied to the subject or the student.
describe("Pip's outfit", () => {
  it.each([
    ['gcse-maths', null, 'calculator'],
    ['gcse-further-maths', 'round-glasses', 'compass'],
    ['gcse-statistics', 'visor', 'chart'],
    ['gcse-english-language', 'blue-pen', 'speech-bubble'],
    ['gcse-english-literature', null, 'book'],
    ['gcse-biology', 'leaf', 'magnifier'],
    ['gcse-chemistry', 'lab-collar', 'test-tube'],
    ['a-level-physics', 'goggles', 'magnet'],
    ['gcse-combined-science', 'safety-specs', 'flask'],
    ['gcse-computer-science', 'headset', 'laptop'],
    ['gcse-history', 'explorer-hat', 'scroll'],
    ['gcse-french', 'beret', 'croissant'],
    ['gcse-german', 'alpine-hat', 'pretzel'],
    ['gcse-spanish', 'neckerchief', 'guitar'],
    ['gcse-drama', 'bow-tie', 'mask'],
    ['gcse-film-studies', 'dark-glasses', 'clapperboard'],
  ])('dresses for %s', (id, item, prop) => {
    expect(outfitFor(id)).toMatchObject({ item, prop });
  });

  it('gives Maths a calculator, not a pencil behind the ear (owner, revision 2)', () => {
    expect(outfitFor('gcse-maths')).toMatchObject({ item: null, prop: 'calculator' });
  });

  it('makes a book the clear cue for English Literature', () => {
    expect(outfitFor('English Literature').prop).toBe('book');
  });

  it('adds a soft flag wash behind Pip only for French, German and Spanish', () => {
    expect(outfitFor('gcse-french').flag).toEqual({
      dir: 'vertical',
      colours: ['#0055a4', '#ffffff', '#ef4135'],
    });
    expect(outfitFor('gcse-german').flag).toEqual({
      dir: 'horizontal',
      colours: ['#000000', '#dd0000', '#ffce00'],
    });
    expect(outfitFor('gcse-spanish').flag).toEqual({
      dir: 'horizontal',
      colours: ['#aa151b', '#f1bf00', '#f1bf00', '#aa151b'],
    });
    expect(outfitFor('gcse-history').flag).toBeUndefined();
  });

  it('does not mistake Further Maths for Maths', () => {
    expect(outfitFor('a-level-further-maths').prop).toBe('compass');
  });

  it('is plain with no subject, or one it has no outfit for', () => {
    expect(outfitFor(null)).toBe(PLAIN);
    expect(outfitFor('gcse-astrology')).toBe(PLAIN);
  });
});

describe("Pip's look of the day", () => {
  const days = Array.from({ length: 90 }, (_, i) =>
    new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10),
  );

  it('has three gently-leaning families with two versions each', () => {
    expect(LOOK_FAMILIES).toEqual(['a', 'b', 'c']);
  });

  it('is the same all day and rotates through all six looks', () => {
    expect(lookFor('2026-11-26')).toEqual(lookFor('2026-11-26'));
    const seen = new Set(days.map((d) => `${lookFor(d).family}${lookFor(d).variant}`));
    expect(seen.size).toBe(6);
  });

  it('changes family from one day to the next', () => {
    expect(lookFor('2026-11-26').family).not.toBe(lookFor('2026-11-27').family);
  });

  it('never depends on the subject or the student', () => {
    // It takes only the day: there is no way to pass a subject or a student.
    expect(lookFor.length).toBe(1);
  });
});
