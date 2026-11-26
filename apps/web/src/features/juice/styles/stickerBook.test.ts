import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio } from '../../../design/tokens';

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
      '.lesson__stage',
      '.answer-option',
    ]) {
      expect(css, hook).toContain(`${SCOPE} ${hook}`);
    }
  });

  it('turns the lesson surround into paper, night paper in dark mode, with readable colours (AA)', () => {
    const blockAt = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      expect(start, selector).toBeGreaterThanOrEqual(0);
      return css.slice(start, css.indexOf('}', start));
    };
    for (const block of [
      blockAt(SCOPE),
      blockAt(":root[data-effect-style='sticker-book'][data-theme='dark']"),
    ]) {
      const token = (name: string) =>
        new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)?.[1];
      const bg = token('arena-bg')!;
      expect(bg).toBeDefined();
      for (const text of ['arena-text', 'arena-text-secondary', 'arena-glow']) {
        expect(contrastRatio(token(text)!, bg), text).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(token('arena-text')!, token('arena-raised')!)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });

  it('is the style on the page from the first paint', () => {
    expect(html).toMatch(/<html lang="en-GB" data-effect-style="sticker-book">/);
  });
});
