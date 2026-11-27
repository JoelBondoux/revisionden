import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOOKS } from '../features/juice/styles/looks';
import { EFFECT_STYLE_IDS } from '../features/juice/styles/registry';
import { colourblindTokens, darkTokens } from './themes';
import { contrastRatio, tokens } from './tokens';

/*
 * J17z (W21 contrast sweep, tier 1; decision 0012): selected states, input boundaries and a few
 * words that sat on the wrong colour, in every look, light and dark. 3:1 for state and boundaries
 * (WCAG 1.4.11), 4.5:1 for text (1.4.3). Colours are read from the rules the components use.
 */
const src = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(src, path), 'utf8');
const squash = (css: string) => css.replace(/\s+/g, ' ');

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(path: string, selector: string): string {
  const css = squash(read(path));
  const at = css.indexOf(`${selector} {`);
  expect(at, `${path}: ${selector}`).toBeGreaterThanOrEqual(0);
  return css.slice(at + selector.length + 2, css.indexOf('}', at));
}

const base = read('design/base.css');
const themes = read('design/themes.css');
const modes = ['light', 'dark'] as const;

/** Every look's tokens in a mode, with the app's shared tokens and the colour-blind cues. */
function palette(id: (typeof EFFECT_STYLE_IDS)[number], mode: 'light' | 'dark', cb = false) {
  const shared = mode === 'light' ? tokens : { ...tokens, ...darkTokens };
  const cues = cb ? colourblindTokens[mode] : {};
  const look = Object.fromEntries(
    Object.entries(LOOKS[id][mode]).filter(([, v]) => /^#[0-9a-f]{6}$/i.test(v)),
  );
  const all: Record<string, string> = { ...shared, ...cues, ...look };
  // The shared control colours (themes.css): the selected fill is the main colour in light and the
  // light edge colour in dark; control edges use the secondary text colour.
  all['--color-selected'] =
    mode === 'light' ? all['--color-primary']! : all['--color-primary-edge']!;
  all['--color-on-selected'] =
    mode === 'light' ? all['--color-text-on-primary']! : all['--color-background']!;
  all['--color-control-edge'] = all['--color-text-secondary']!;
  return all;
}

describe('the shared control colours', () => {
  it('are defined once, for light and dark (themes.css)', () => {
    expect(squash(themes)).toContain(
      ':root { --color-control-edge: var(--color-text-secondary); --color-selected: var(--color-primary); --color-on-selected: var(--color-text-on-primary); }',
    );
    expect(squash(themes)).toContain(
      ":root[data-theme='dark'] { --color-selected: var(--color-primary-edge); --color-on-selected: var(--color-background); }",
    );
  });

  for (const mode of modes)
    it.each(EFFECT_STYLE_IDS)(`stand out in %s, ${mode}`, (id) => {
      const t = palette(id, mode);
      for (const bg of ['--color-background', '--color-surface', '--color-primary-soft']) {
        expect(
          contrastRatio(t['--color-selected']!, t[bg]!),
          `selected on ${bg}`,
        ).toBeGreaterThanOrEqual(3);
      }
      for (const bg of ['--color-background', '--color-surface'])
        expect(
          contrastRatio(t['--color-control-edge']!, t[bg]!),
          `edge on ${bg}`,
        ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(t['--color-on-selected']!, t['--color-selected']!),
      ).toBeGreaterThanOrEqual(4.5);
    });
});

describe('selected chips, tabs, avatar options and the period toggle', () => {
  it('draw their edge in the control colour', () => {
    for (const [path, selector] of [
      ['features/onboarding/onboarding.css', '.chip'],
      ['features/avatar/avatar.css', '.avatar-builder__tab'],
      ['features/avatar/avatar.css', '.avatar-option'],
      ['features/onboarding/onboarding.css', '.field__input'],
      ['features/rewards/rewards.css', '.rewards-form input, .rewards-form select'],
    ])
      expect(rule(path!, selector!), selector).toContain(
        'border: 2px solid var(--color-control-edge);',
      );
  });

  it('fill the selected one with the selected colour, its words in the on-selected colour', () => {
    for (const [path, selector] of [
      [
        'features/onboarding/onboarding.css',
        ".chip[aria-pressed='true'], .chip[aria-checked='true']",
      ],
      ['features/avatar/avatar.css', ".avatar-builder__tab[aria-selected='true']"],
      ['features/stats/stats.css', ".period-toggle__button[aria-pressed='true']"],
    ]) {
      const decl = rule(path!, selector!);
      expect(decl, selector).toContain('background: var(--color-selected);');
      expect(decl, selector).toContain('color: var(--color-on-selected);');
    }
    expect(rule('features/avatar/avatar.css', ".avatar-option[aria-pressed='true']")).toContain(
      'border-color: var(--color-selected);',
    );
  });

  it('give every select a visible edge, light and dark', () => {
    expect(squash(base)).toMatch(/select \{[^}]*border: 2px solid var\(--color-control-edge\);/);
  });
});

describe('words on the wrong colour', () => {
  for (const mode of modes)
    it.each(EFFECT_STYLE_IDS)(`read in %s, ${mode}`, (id) => {
      for (const cb of [false, true]) {
        const t = palette(id, mode, cb);
        const tokenOf = (decl: string) => /color: var\((--[\w-]+)\)/.exec(decl)?.[1] ?? '';
        // A card's topic on the flip card, and the thanks after sending feedback, on the page.
        for (const [path, selector] of [
          ['features/flashcards/flashcards.css', '.flip-card__topic'],
          ['features/feedback/feedback.css', '.feedback__thanks'],
        ]) {
          const fg = t[tokenOf(rule(path!, selector!))]!;
          for (const bg of ['--color-background', '--color-surface'])
            expect(contrastRatio(fg, t[bg]!), `${selector} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

  // "Up next" on Home: Garden Grow and Sticker Book paint the card a fixed pale colour in both modes.
  it.each([
    ['garden-grow', '#e3f4e4'],
    ['sticker-book', '#fde4df'],
  ])('keeps "Up next" in dark ink on the %s card, light and dark', (id, card) => {
    const decl = rule(
      `features/juice/styles/${id}.css`,
      `:root[data-effect-style='${id}'] .home-next`,
    );
    const ink = /(?:^|; )color: (#[0-9a-f]{6});/.exec(decl)?.[1];
    expect(ink, `${id} .home-next color`).toBeTruthy();
    expect(contrastRatio(ink!, card)).toBeGreaterThanOrEqual(4.5);
  });
});
