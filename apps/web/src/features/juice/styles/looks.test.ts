import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, tokens } from '../../../design/tokens';
import {
  colourblindTokens,
  darkTokens,
  resolveNonTextPairs,
  resolvePairs,
} from '../../../design/themes';
import { LOOK_TOKENS, LOOKS, lookCss } from './looks';
import { EFFECT_STYLE_IDS } from './registry';

// J15s (owner, 2026-11-26): "When I change theme only the Today box on the Map page changes." Each
// effect style is now a full look: it sets the shared tokens every component reads, so the whole
// app changes, while every text pair stays readable (AA) in light, dark and colour-blind.
const read = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');
const isColour = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

describe.each(EFFECT_STYLE_IDS)('the %s look', (id) => {
  const css = read(`${id}.css`);

  it.each(['light', 'dark'] as const)('sets every look token in %s', (mode) => {
    for (const token of LOOK_TOKENS) expect(LOOKS[id][mode][token], token).toBeTruthy();
  });

  it.each(['light', 'dark'] as const)(
    'is carried by its stylesheet in %s, value for value',
    (mode) => {
      expect(css).toContain(lookCss(id, mode));
    },
  );

  for (const mode of ['light', 'dark'] as const) {
    for (const palette of ['standard', 'colourblind'] as const) {
      it(`keeps every text pair readable (AA) in ${mode}, ${palette} colours`, () => {
        const base = mode === 'light' ? tokens : { ...tokens, ...darkTokens };
        const cues = palette === 'colourblind' ? colourblindTokens[mode] : {};
        const look = Object.fromEntries(
          Object.entries(LOOKS[id][mode]).filter(([, v]) => isColour(v)),
        );
        const all: Record<string, string> = { ...base, ...cues, ...look };
        for (const pair of resolvePairs(all)) {
          expect(contrastRatio(pair.foreground, pair.background), pair.name).toBeGreaterThanOrEqual(
            4.5,
          );
        }
        // In light mode some components use the main colour itself as text (the current tab, "See
        // all"); dark mode swaps those for the lighter edge colour (design/themes.css).
        for (const bg of mode === 'dark'
          ? []
          : ['--color-surface', '--color-background', '--color-primary-soft']) {
          expect(
            contrastRatio(all['--color-primary']!, all[bg]!),
            `main colour as text on ${bg}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
        for (const pair of resolveNonTextPairs(all)) {
          expect(contrastRatio(pair.foreground, pair.background), pair.name).toBeGreaterThanOrEqual(
            3,
          );
        }
      });
    }
  }
});

describe('the looks', () => {
  it('differ visibly from the base look (page, surface, main colour and shape)', () => {
    const base = LOOKS['doodle-diary'].light;
    for (const id of EFFECT_STYLE_IDS.filter((s) => s !== 'doodle-diary')) {
      const look = LOOKS[id].light;
      const changed = (
        [
          '--color-background',
          '--color-surface',
          '--color-primary',
          '--shadow-3d-neutral',
          '--radius-lg',
        ] as const
      ).filter((t) => look[t] !== base[t]);
      expect(changed.length, id).toBeGreaterThanOrEqual(4);
    }
  });

  it('never change the cue colours, so the colour-blind palette keeps working', () => {
    for (const token of LOOK_TOKENS) {
      expect(token).not.toMatch(/success|danger|warning|weak|gold|streak/);
    }
  });

  it('letter page and card headings in the look heading font, and body text stays Nunito', () => {
    const base = read('../../../design/base.css');
    expect(base).toMatch(
      /h1,\s*h2\s*\{[^}]*font-family:\s*var\(--font-heading, var\(--font-family\)\)/,
    );
    expect(base).toMatch(/body\s*\{[^}]*font-family:\s*var\(--font-family\)/);
  });
});

describe.each(EFFECT_STYLE_IDS.filter((s) => s !== 'doodle-diary'))(
  'the %s background pattern',
  (id) => {
    it('is its own shape, drawn as a mask in the look ink', () => {
      const css = read(`${id}.css`);
      const scope = `:root[data-effect-style='${id}'][data-pattern='on'] body::before`;
      const start = css.indexOf(`${scope} {`);
      expect(start, scope).toBeGreaterThanOrEqual(0);
      const rule = css.slice(start, css.indexOf('}', start));
      expect(rule).toContain(`url('./patterns/${id}.svg')`);
      expect(rule).toMatch(/-webkit-mask-image/);
      const svg = read(`patterns/${id}.svg`);
      expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    });
  },
);
