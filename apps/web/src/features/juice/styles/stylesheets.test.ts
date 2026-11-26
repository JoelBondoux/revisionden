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

const HOOKS = [
  '.combo-badge',
  '.star--earned',
  '.burst__particle',
  '.confetti__piece',
  '.float-up',
  '.today-strip',
  '.today-strip__mission',
  '.today-strip__daily',
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
    expect(html).toMatch(/<html lang="en-GB" data-effect-style="doodle-diary">/);
  });
});

// J10a2: styles that turn the lesson surround away from the dark arena keep the question on a
// plain card, and their surround colours meet AA in light and dark.
const SURROUND_STYLES = ['doodle-diary', 'sticker-book'] as const;

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
    expect(provider).toContain(`import '@fontsource/patrick-hand/400.css';`);
    expect(read('doodle-diary.css')).toContain("'Patrick Hand'");
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

// J10f: Doodle Diary marks a right answer in the success colour (green, or blue for colour-blind
// friendly colours) with a light wash, so it never reads as a red "wrong" mark.
describe('the Doodle Diary right answer', () => {
  const css = read('doodle-diary.css');
  const rules = [...css.matchAll(/([^{}]*answer-option--right[^{}]*)\{([^}]*)\}/g)];

  it('uses the success colour and a wash, never red', () => {
    expect(rules.length).toBeGreaterThanOrEqual(2);
    for (const [, , body] of rules) {
      expect(body).not.toMatch(/--dd-red|#b8322a|#c8382e|#ff8a80/i);
      expect(body).toMatch(/var\(--color-success/);
    }
    expect(
      rules.some(([, , body]) => /background:\s*var\(--color-success-soft\)/.test(body!)),
    ).toBe(true);
  });
});

// J10g: an earned level's number sits on a plain fill, never on hatching, and is readable (AA).
describe.each(EFFECT_STYLE_IDS)('the %s earned levels on Rewards', (id) => {
  const css = read(`${id}.css`);

  it('never puts a pattern behind the level number', () => {
    for (const [, body] of css.matchAll(/rewards__step--earned[^{]*\{([^}]*)\}/g)) {
      expect(body).not.toMatch(/gradient|url\(/);
    }
  });
});

describe('the Doodle Diary earned level', () => {
  it('shows its number in dark ink on solid highlighter, in light and dark mode (AA)', () => {
    const css = read('doodle-diary.css');
    const rule = /\.rewards__step--earned \{([^}]*)\}/.exec(css)![1]!;
    const background = /background:\s*(#[0-9a-f]{6})/i.exec(rule)?.[1];
    const colour = /\bcolor:\s*(#[0-9a-f]{6})/i.exec(rule)?.[1];
    expect(contrastRatio(colour!, background!)).toBeGreaterThanOrEqual(4.5);
    expect(css).not.toMatch(/\[data-theme='dark'\] \.rewards__step--earned/);
  });
});
