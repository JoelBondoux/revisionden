import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio } from '../../../design/tokens';
import { EFFECT_STYLE_IDS } from './registry';
import { listLicences } from '../../about/licences';

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

// J13a: every style restyles the same moments; the screens themselves are the shared Doodle
// Diary skin (design/skin.css), which no style may restyle.
const HOOKS = [
  '.combo-badge',
  '.star--earned',
  '.burst__particle',
  '.confetti__piece',
  '.float-up',
];

/** Shared surfaces that belong to the base skin: no style restyles them (J13a). */
const BASE_SURFACES = [
  '.today-strip',
  '.unit-card',
  '.unit-badge',
  '.page-header',
  '.rewards__step',
  '.lesson__stage',
  '.answer-option',
  '.card',
  '.btn',
  '.chip',
  '.pill',
  '.progress',
  '.main-nav',
  '.link-tile',
  '.hex',
];

/** The accent set each unlockable style sets: what is chosen, scribbles and the mastered fill. */
const ACCENTS = [
  '--highlight',
  '--highlight-ink',
  '--scribble-a',
  '--scribble-b',
  '--mastered-a',
  '--mastered-b',
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

  it('restyles the lesson and reward moments', () => {
    for (const hook of HOOKS) expect(css, hook).toContain(`${scope} ${hook}`);
  });

  it('leaves the screens to the shared skin (no base surface restyled)', () => {
    for (const list of selectors(css)) {
      for (const selector of list.split(',')) {
        for (const surface of BASE_SURFACES) {
          // The block itself and its BEM parts (.today-strip__title, .btn--gold).
          expect(selector, `${id}: ${surface}`).not.toMatch(
            new RegExp(`\\${surface}(?:__|--|(?![\\w-]))`),
          );
        }
      }
    }
  });

  it('sets a full accent set, readable in light and dark (AA)', () => {
    const start = css.indexOf(`${scope} {`);
    const block = css.slice(start, css.indexOf('}', start));
    const value = (name: string) => new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)?.[1];
    if (id === 'doodle-diary') {
      // The base look: it keeps the skin's own accents.
      for (const name of ACCENTS) expect(value(name), name).toBeUndefined();
      return;
    }
    for (const name of ACCENTS) expect(value(name), `${id} ${name}`).toBeDefined();
    // Dark text on what is chosen (chips, tabs, the current tab) in every theme ...
    expect(contrastRatio(value('--highlight-ink')!, value('--highlight')!)).toBeGreaterThanOrEqual(
      4.5,
    );
    // ... and the tick on a mastered topic (an icon: 3:1).
    for (const fill of ['--mastered-a', '--mastered-b']) {
      expect(contrastRatio('#2b2a3a', value(fill)!), `${id} ${fill}`).toBeGreaterThanOrEqual(3);
    }
    // No dark-mode override of the accents: they work on night paper as they are.
    expect(css).not.toMatch(/\[data-theme='dark'\] \{[^}]*--highlight/);
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
    expect(html).toMatch(/<html lang="en-GB" data-effect-style="doodle-diary">/);
  });
});

// J10a2: styles that turn the lesson surround away from the dark arena re-colour it readably in
// light and dark. (The question card and answers are the shared skin's: design/skin.css.)
const SURROUND_STYLES = ['doodle-diary', 'sticker-book'] as const;

describe.each(SURROUND_STYLES)('the %s lesson surround', (id) => {
  const css = read(`${id}.css`);
  const scope = `:root[data-effect-style='${id}']`;

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
      // An empty progress track stays visible (WCAG 1.4.11, J10f).
      expect(
        contrastRatio(token('arena-track')!, token('arena-bg')!),
        `${selector} arena-track`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

// J10d: Doodle Diary letters its headings in Patrick Hand, self-hosted (SIL Open Font Licence) and
// listed with the app's open-source licences.
describe('the Doodle Diary handwriting', () => {
  const webRoot = join(import.meta.dirname, '..', '..', '..', '..');
  const readJson = (path: string) =>
    JSON.parse(readFileSync(path, 'utf8')) as Record<string, never>;

  it('is self-hosted and loaded with the app', () => {
    expect(read('../../../design/base.css')).toContain(
      `@import '@fontsource/patrick-hand/400.css';`,
    );
    expect(read('../../../design/tokens.css')).toContain("--font-hand: 'Patrick Hand'");
  });

  it('is listed under the open-source licences', () => {
    const licences = listLicences(readJson(join(webRoot, 'package.json')), (name) =>
      readJson(join(webRoot, 'node_modules', name, 'package.json')),
    );
    expect(licences).toContainEqual(
      expect.objectContaining({ name: '@fontsource/patrick-hand', licence: 'OFL-1.1' }),
    );
  });
});
