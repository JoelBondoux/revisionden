import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, tokens } from './tokens';
import {
  colourblindTokens,
  darkTokens,
  deltaE,
  resolvePairs,
  simulate,
  type Deficiency,
} from './themes';

const themesCss = readFileSync(join(__dirname, 'themes.css'), 'utf8').toLowerCase();

const light = { ...tokens };
const dark = { ...tokens, ...darkTokens };
const lightCb = { ...light, ...colourblindTokens.light };
const darkCb = { ...dark, ...colourblindTokens.dark };

describe('dark theme', () => {
  it('redefines every colour the light theme has', () => {
    const colours = Object.keys(tokens).filter(
      (k) => k.startsWith('--color-') && /^#[0-9a-f]{6}$/i.test(tokens[k as keyof typeof tokens]),
    );
    for (const name of colours) expect(darkTokens, name).toHaveProperty([name]);
  });

  it('defines every dark token in themes.css with the same value', () => {
    for (const [name, value] of Object.entries(darkTokens)) {
      expect(themesCss, name).toContain(`${name}: ${value};`.toLowerCase());
    }
  });
});

describe.each([
  ['light', light],
  ['dark', dark],
  ['light colour-blind', lightCb],
  ['dark colour-blind', darkCb],
] as const)('%s: text contrast (WCAG 2.2 AA)', (_, palette) => {
  it.each(resolvePairs(palette))('$name reaches 4.5 to 1', ({ foreground, background }) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('colour-blind friendly palette', () => {
  it('swaps red and green right and wrong cues for blue and orange', () => {
    const hue = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return { r, g, b };
    };
    const right = hue(lightCb['--color-success']);
    const wrong = hue(lightCb['--color-danger']);
    expect(right.b).toBeGreaterThan(right.g); // blue, not green
    expect(wrong.r).toBeGreaterThan(wrong.b); // orange
    expect(wrong.g).toBeGreaterThan(40); // not pure red
  });

  it('defines the colour-blind tokens in themes.css for light and dark', () => {
    for (const [name, value] of Object.entries(colourblindTokens.light)) {
      expect(themesCss, name).toContain(`${name}: ${value};`.toLowerCase());
    }
    for (const [name, value] of Object.entries(colourblindTokens.dark)) {
      expect(themesCss, name).toContain(`${name}: ${value};`.toLowerCase());
    }
  });

  const pairs: [string, string, string][] = [
    ['right vs wrong answer', '--color-success', '--color-danger'],
    ['right vs wrong feedback', '--color-success', '--color-warning'],
    ['right answer in the arena vs a wrong cue', '--arena-correct', '--color-danger'],
    ['mastered vs weak topic', '--color-success', '--color-weak'],
  ];
  const deficiencies: Deficiency[] = ['deuteranopia', 'protanopia', 'tritanopia'];

  it.each(
    pairs.flatMap(([label, a, b]) =>
      deficiencies.flatMap((d) =>
        (
          [
            ['light', lightCb],
            ['dark', darkCb],
          ] as const
        ).map(([theme, p]) => ({
          label,
          theme,
          d,
          a: p[a as keyof typeof p],
          b: p[b as keyof typeof p],
        })),
      ),
    ),
  )('$label stay clearly different with $d ($theme)', ({ a, b, d }) => {
    // CIE76 colour difference after simulating the deficiency; 20 is "clearly different".
    expect(deltaE(simulate(a, d), simulate(b, d))).toBeGreaterThanOrEqual(20);
  });
});

describe('gold surfaces on the map', () => {
  const pagesCss = readFileSync(join(__dirname, '../pages/pages.css'), 'utf8');

  it('draws the mastered hex checkmark in the dark-on-gold text colour', () => {
    const rule = /\.hex--mastered \.hex__shape\s*\{([^}]*)\}/.exec(pagesCss)?.[1] ?? '';
    expect(rule).toContain('--hex-fill: var(--color-gold)');
    expect(rule).toMatch(/(^|[^-])color: var\(--color-text-on-gold\)/);
  });

  it('keeps the mastered hex checkmark readable in every theme', () => {
    for (const palette of [light, dark, lightCb, darkCb]) {
      const pair = resolvePairs(palette).find((p) => p.name === 'mastered hex checkmark');
      expect(pair).toBeDefined();
      expect(contrastRatio(pair!.foreground, pair!.background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
