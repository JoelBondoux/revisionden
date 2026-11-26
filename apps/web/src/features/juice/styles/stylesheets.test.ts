import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  it('never puts a shadow filter on a topic hex, which would double its name', () => {
    expect(css).not.toMatch(/\.hex--mastered\s*\{[^}]*filter/);
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
