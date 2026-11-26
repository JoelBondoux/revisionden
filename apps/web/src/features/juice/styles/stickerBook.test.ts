import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// J10a: Sticker Book, the default effect style. Its stylesheet only ever applies while the style
// is active, so another style can replace it completely.
const css = readFileSync(join(import.meta.dirname, 'sticker-book.css'), 'utf8');
const html = readFileSync(join(import.meta.dirname, '../../../../index.html'), 'utf8');
const SCOPE = ":root[data-effect-style='sticker-book']";

/** Every rule's selector list, outside @keyframes (whose steps are not selectors). */
function selectors(source: string): string[] {
  const withoutKeyframes = source.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const withoutComments = withoutKeyframes
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@media[^{]*\{/g, '');
  return [...withoutComments.matchAll(/([^{}@;]+)\{/g)]
    .map((m) => m[1]!.trim())
    .filter((s) => s && !s.startsWith('@') && !s.startsWith('('));
}

describe('Sticker Book stylesheet', () => {
  it('only applies while Sticker Book is the active style', () => {
    const all = selectors(css);
    expect(all.length).toBeGreaterThan(10);
    for (const list of all) {
      for (const selector of list.split(','))
        expect(selector.trim(), list).toMatch(/^:root\[data-effect-style='sticker-book'\]/);
    }
  });

  it('restyles the lesson moments, the Home screen and the Rewards page', () => {
    for (const hook of [
      '.combo-badge',
      '.star--earned',
      '.burst__particle',
      '.confetti__piece',
      '.float-up',
      '.map-summary',
      '.mission',
      '.daily-card',
      '.hex--mastered',
      '.page-header .pill',
      '.rewards__step--earned',
    ]) {
      expect(css, hook).toContain(`${SCOPE} ${hook}`);
    }
  });

  it('is the style on the page from the first paint', () => {
    expect(html).toMatch(/<html lang="en-GB" data-effect-style="sticker-book">/);
  });
});
