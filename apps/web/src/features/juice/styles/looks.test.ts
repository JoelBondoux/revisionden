import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrastRatio, tokens } from '../../../design/tokens';
import {
  colourblindTokens,
  darkTokens,
  resolveNonTextPairs,
  resolvePairs,
} from '../../../design/themes';
import { ARENA_FROM_PAGE, LOOK_TOKENS, LOOKS, lookCss } from './looks';
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
      // Prettier may wrap long values over lines, so compare with the spacing squashed.
      const squash = (text: string) =>
        text.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')');
      expect(squash(css)).toContain(squash(lookCss(id, mode)));
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

// J15s revision (owner sign-off of the all-themes mockup, revision 5.1): each look follows the
// approved mockup: its own page art, its display font, and the night styles stay at night.
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
};

describe('the looks follow the approved mockup', () => {
  it('paints every page with the style’s own art, in light and dark', () => {
    for (const id of EFFECT_STYLE_IDS)
      for (const mode of ['light', 'dark'] as const) {
        const look = LOOKS[id][mode];
        expect(`${look['--page-wash']} ${look['--page-texture']}`, `${id} ${mode}`).toMatch(
          /gradient\(/,
        );
      }
  });

  // Codex review of train #337 (lead: blocking): textures obey "Background pattern" and high
  // contrast, and reading comfort settings win over every look.
  it('keeps textures (lines, halftone, scanlines, stars) out of the washes', () => {
    for (const id of EFFECT_STYLE_IDS)
      for (const mode of ['light', 'dark'] as const)
        expect(LOOKS[id][mode]['--page-wash'], `${id} ${mode}`).not.toMatch(/repeating-|\dpx| \/ /);
  });

  const base = read('../../../design/base.css');
  const rule = (selector: string) => {
    const at = base.indexOf(`${selector} {`);
    expect(at, selector).toBeGreaterThanOrEqual(0);
    return base.slice(at, base.indexOf('}', at));
  };

  it('shows textures only with the pattern on, and no page art with high contrast', () => {
    expect(rule('body')).toMatch(
      /background:\s*var\(--page-wash, none\),\s*var\(--color-background\)/,
    );
    expect(rule(":root[data-pattern='on'] body")).toMatch(
      /background:\s*var\(--page-texture, none\),\s*var\(--page-wash, none\),\s*var\(--color-background\)/,
    );
    const contrast = base.slice(
      base.indexOf('@media (prefers-contrast: more), (forced-colors: active)'),
    );
    expect(contrast).toMatch(
      /:root\[data-pattern='on'\] body\s*\{\s*background:\s*var\(--color-background\)/,
    );
  });

  it('lets the reading tints win over every look, with no page art over them', () => {
    const reading = read('../../reading/reading.css');
    const themes = read('../../../design/themes.css');
    const tintOf = (css: string, selector: string) => {
      const at = css.indexOf(`${selector} {`);
      const block = css.slice(at, css.indexOf('}', at));
      return [
        /--color-background:\s*(#\w+)/.exec(block)?.[1],
        /--color-surface:\s*(#\w+)/.exec(block)?.[1],
      ];
    };
    for (const tint of ['cream', 'blue']) {
      expect(tintOf(base, `:root:root[data-reading-tint='${tint}'][data-effect-style]`)).toEqual(
        tintOf(reading, `:root[data-reading-tint='${tint}']`),
      );
      expect(
        tintOf(
          base,
          `:root:root[data-reading-tint='${tint}'][data-effect-style][data-theme='dark']`,
        ),
      ).toEqual(tintOf(themes, `:root[data-theme='dark'][data-reading-tint='${tint}']`));
    }
    expect(rule(':root:root[data-reading-tint][data-effect-style]')).toMatch(
      /--page-wash:\s*none;\s*--page-texture:\s*none/,
    );
  });

  it('lets the dyslexia-friendly font win over every heading and style font', () => {
    expect(rule(":root:root[data-reading-font='dyslexic'][data-effect-style]")).toContain(
      '--font-heading: var(--font-family);',
    );
    expect(rule(":root[data-reading-font='dyslexic'] body *")).toContain(
      'font-family: var(--font-family) !important;',
    );
  });

  it('puts Starlight and Pixel Arcade at night in dark mode', () => {
    for (const id of ['starlight', 'pixel-arcade'] as const)
      expect(lum(LOOKS[id].dark['--color-background']), id).toBeLessThan(0.05);
  });

  // A vivid page needs light text, which the shared warning and danger colours are not made for, so
  // vivid pages show in dark mode and light mode keeps a light page (like Starlight and Pixel Arcade).
  it('gives Pop Burst a vivid purple page with sunny highlights in dark mode', () => {
    const pop = LOOKS['pop-burst'].dark;
    expect(lum(pop['--color-background'])).toBeLessThan(0.2);
    expect(lum(pop['--color-primary-edge'])).toBeGreaterThan(0.6);
  });

  it.each([
    ['sticker-book', 'Baloo 2'],
    ['pop-burst', 'Baloo 2'],
    ['starlight', 'Baloo 2'],
    ['garden-grow', 'Baloo 2'],
    ['comic-pop', 'Bangers'],
    ['pixel-arcade', 'Press Start 2P'],
    ['doodle-diary', 'Patrick Hand'],
    ['petal-glow', 'Fredoka'],
    ['turbo-drive', 'Russo One'],
    ['rainbow-parade', 'Baloo 2'],
  ] as const)('letters %s headings in %s, served from our own site', (id, font) => {
    expect(LOOKS[id].light['--font-heading']).toContain(`'${font}'`);
    const pkg = font.toLowerCase().replace(/ /g, '-');
    expect(read(`${id}.css`)).toContain(`@import '@fontsource/${pkg}`);
  });
});

// J17x (owner report: white text on light pages): arena screens (lessons, practice, tests, set
// complete) sit on the look's own page, so the arena's text, cards and track come from the look's
// page tokens, by one rule on `.arena` that no setting (pattern, high contrast, tints) can undo.
describe("the arena on the look's page", () => {
  const arena = read('../../../design/arena.css');
  const block = (() => {
    const at = arena.indexOf('.arena {');
    expect(at, '.arena {').toBeGreaterThanOrEqual(0);
    return arena.slice(at, arena.indexOf('}', at));
  })();

  it('takes every arena page token from the look, on the arena itself', () => {
    for (const [token, from] of Object.entries(ARENA_FROM_PAGE))
      expect(block, token).toContain(`${token}: var(${from});`);
  });

  it('no longer paints its own page behind the look (settings would decide which wins)', () => {
    expect(arena).not.toMatch(/body:has\(\.arena[^{]*\{[^}]*background/);
  });

  it('leaves the arena page tokens to the look in every style sheet', () => {
    for (const id of EFFECT_STYLE_IDS)
      for (const token of Object.keys(ARENA_FROM_PAGE))
        expect(read(`${id}.css`), `${id} ${token}`).not.toMatch(new RegExp(`${token}:`));
  });

  for (const mode of ['light', 'dark'] as const) {
    it.each(EFFECT_STYLE_IDS)(`reads in %s, ${mode} (AA, and a visible track)`, (id) => {
      const look = LOOKS[id][mode] as Record<string, string>;
      const t = (token: keyof typeof ARENA_FROM_PAGE) => look[ARENA_FROM_PAGE[token]]!;
      for (const [fg, bg] of [
        ['--arena-text', '--arena-bg'],
        ['--arena-text', '--arena-raised'],
        ['--arena-text-secondary', '--arena-bg'],
        ['--arena-text-secondary', '--arena-raised'],
        ['--arena-glow', '--arena-bg'],
      ] as const)
        expect(contrastRatio(t(fg), t(bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t('--arena-track'), t('--arena-bg'))).toBeGreaterThanOrEqual(3);
    });
  }

  it("puts the answer buttons' own text colour on their fills, not the page ink", () => {
    expect(arena).toMatch(/\.answer-option \{[^}]*color: var\(--arena-on-option\);/);
    for (const palette of [tokens, { ...tokens, ...colourblindTokens.light }] as Record<
      string,
      string
    >[])
      for (const fill of [1, 2, 3, 4].map((n) => `--arena-option-${n}`).concat('--arena-correct'))
        expect(
          contrastRatio(palette['--arena-on-option']!, palette[fill]!),
          fill,
        ).toBeGreaterThanOrEqual(4.5);
  });
});

// J17x: the mastery fill is pale in every look, a fill only: nothing writes white or the
// on-primary colour on it (1.1 to 1.3:1).
describe('the mastery fill', () => {
  const sheets = [
    '../../../components/components.css',
    '../../../pages/pages.css',
    '../../../map/map.css',
    '../../../map/wiggly.css',
    '../../../design/arena.css',
    '../juice.css',
    ...EFFECT_STYLE_IDS.map((id) => `${id}.css`),
  ];

  it('never carries white or on-primary text', () => {
    for (const sheet of sheets)
      for (const [, body] of read(sheet).matchAll(/\{([^{}]*)\}/g))
        if (/background[^;]*--color-mastery-fill/.test(body!))
          expect(body, sheet).not.toMatch(
            /(^|[^-])color:\s*(#fff\b|#ffffff\b|white\b|var\(--color-text-on-primary\))/,
          );
  });
});
