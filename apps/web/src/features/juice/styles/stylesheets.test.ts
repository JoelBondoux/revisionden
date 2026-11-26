import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio } from '../../../design/tokens';
import { EFFECT_STYLE_IDS } from './registry';

// J10: every effect style is one stylesheet, `<id>.css`, whose rules only apply while that style
// is active, so styles can be swapped, added or removed without leaving anything behind. Each
// restyles the same moments and screens, so no style looks half-finished.
const read = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');
const html = read('../../../../index.html');
const provider = read('EffectStyleProvider.tsx');

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

const HOOKS = [
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
];

describe.each(EFFECT_STYLE_IDS)('the %s stylesheet', (id) => {
  const css = read(`${id}.css`);
  const scope = `:root[data-effect-style='${id}']`;

  it('only applies while its style is active', () => {
    const all = selectors(css);
    expect(all.length).toBeGreaterThan(10);
    for (const list of all) {
      for (const selector of list.split(',')) {
        expect(selector.trim().startsWith(scope), list).toBe(true);
      }
    }
  });

  it('restyles the lesson moments, the Home screen and the Rewards page', () => {
    for (const hook of HOOKS) expect(css, hook).toContain(`${scope} ${hook}`);
  });

  it('is loaded with the app', () => {
    expect(provider).toContain(`import './${id}.css';`);
  });
});

describe('the default style', () => {
  it('is on the page from the first paint', () => {
    expect(html).toMatch(/<html lang="en-GB" data-effect-style="sticker-book">/);
  });
});

// J10a2: styles that turn the lesson surround away from the dark arena keep the question on a
// plain card, and their surround colours meet AA in light and dark.
const SURROUND_STYLES = ['sticker-book'] as const;

describe.each(SURROUND_STYLES)('the %s lesson surround', (id) => {
  const css = read(`${id}.css`);
  const scope = `:root[data-effect-style='${id}']`;

  it('puts the question and answers on a plain card', () => {
    expect(css).toContain(`${scope} .lesson__stage`);
    expect(css).toContain(`${scope} .answer-option`);
    const stage = css.slice(css.indexOf(`${scope} .lesson__stage {`));
    const rule = stage.slice(0, stage.indexOf('}'));
    expect(rule).not.toMatch(/rotate|animation|background-image|gradient/);
  });

  it('re-colours the arena readably (AA), in light and in dark', () => {
    for (const selector of [scope, `${scope}[data-theme='dark']`]) {
      const start = css.indexOf(`${selector} {`);
      expect(start, selector).toBeGreaterThanOrEqual(0);
      const block = css.slice(start, css.indexOf('}', start));
      const token = (name: string) =>
        new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)?.[1];
      for (const text of ['arena-text', 'arena-text-secondary', 'arena-glow']) {
        expect(
          contrastRatio(token(text)!, token('arena-bg')!),
          `${selector} ${text}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(token('arena-text')!, token('arena-raised')!)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});
