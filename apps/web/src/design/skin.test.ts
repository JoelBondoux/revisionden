import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// J13a: the Doodle Diary skin is the app's base look, as shared tokens and components
// (docs/design/j12/SKIN.md). Every unlockable style keeps these and changes accents only.
const read = (file: string) => readFileSync(join(__dirname, file), 'utf8');
const skin = read('skin.css');
const base = read('base.css');
const links = read('../components/links.css');

/** The declarations of the rule whose selector list includes `selector` (outside @media). */
function rule(css: string, selector: string): string {
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of flat.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    if (selectors.includes(selector)) return m[2]!;
  }
  return '';
}

/** The body of the first `@media` block whose query contains `query`. */
function media(css: string, query: string): string {
  const start = css.indexOf(`@media ${query}`);
  if (start < 0) return '';
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}' && (depth -= 1) === 0) return css.slice(start, i + 1);
  }
  return '';
}

describe('the Doodle Diary skin (J13a)', () => {
  it('loads with the base styles', () => {
    expect(base).toContain("@import './skin.css';");
  });

  it.each([
    ':root .btn',
    ':root .card',
    ':root .pill',
    ':root .chip',
    ':root .tabs__tab',
    ':root .period-toggle__button',
    ':root .toast',
    ':root .field__input',
    ':root main select',
    ':root .icon-button',
  ])('edges %s in pen ink with wobbly corners', (selector) => {
    const body = rule(skin, selector);
    expect(body).toMatch(/border:\s*2px solid var\(--ink\)/);
    expect(body).toMatch(/border-radius:\s*var\(--wobble(-sm)?\)/);
  });

  it('draws settings rows (link tiles) as pen-drawn cards with the drawn shadow', () => {
    const tile = rule(links, '.link-tile');
    expect(tile).toMatch(/border:\s*2px solid var\(--ink\)/);
    expect(tile).toMatch(/border-radius:\s*var\(--wobble\)/);
    expect(tile).toMatch(/box-shadow:\s*var\(--lift\)/);
  });

  it.each([':root .btn', ':root .card', ':root .toast'])(
    'lifts %s with the hard drawn shadow',
    (selector) => {
      expect(rule(skin, selector)).toMatch(/box-shadow:\s*var\(--lift\)/);
    },
  );

  it.each([
    ":root .chip[aria-pressed='true']",
    ':root .tabs__tab--active',
    ":root .period-toggle__button[aria-pressed='true']",
    ":root .main-nav .main-nav__link[aria-current='page']",
  ])('colours in %s with highlighter and dark ink text', (selector) => {
    const body = rule(skin, selector);
    expect(body).toMatch(/background:\s*var\(--highlight\)/);
    expect(body).toMatch(/color:\s*var\(--highlight-ink\)/);
  });

  it('circles the current tab in the bottom bar and the tablet rail', () => {
    expect(rule(skin, ":root .main-nav .main-nav__link[aria-current='page']")).toMatch(
      /border:\s*2px solid var\(--ink\)/,
    );
    expect(rule(skin, ':root .main-nav')).toMatch(/border-(top|color)[^;]*var\(--ink\)/);
  });

  it('draws progress bars as an inked outline with a scribble that ends in an ink mark', () => {
    expect(rule(skin, ':root .progress')).toMatch(/inset 0 0 0 2px var\(--ink\)/);
    const fill = rule(skin, ':root .progress__fill');
    expect(fill).toMatch(/repeating-linear-gradient/);
    // The scribble is too pale on paper on its own (3:1), so its end is marked in ink.
    expect(fill).toMatch(/inset -2px 0 0 var\(--ink\)/);
  });

  it('outlines topic hexes in ink, so even a locked one reaches 3:1 on paper', () => {
    expect(rule(skin, ':root .hex--in-progress .hex__shape')).toMatch(
      /--hex-border:\s*var\(--ink\)/,
    );
    expect(rule(skin, ':root .hex--locked .hex__shape')).toMatch(
      /--hex-border:\s*var\(--ink-soft\)/,
    );
  });

  it('uses the hand font for page titles and card titles only', () => {
    expect(rule(skin, ':root main h1')).toMatch(/font-family:\s*var\(--font-hand\)/);
    expect(rule(skin, ':root .card__title')).toMatch(/font-family:\s*var\(--font-hand\)/);
    const handRules = [
      ...skin.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{[^{}]*--font-hand[^{}]*\}/g),
    ].map((m) => m[1]!.trim());
    for (const selectors of handRules) {
      for (const selector of selectors.split(',').map((s) => s.trim())) {
        expect([':root main h1', ':root .card__title'], selector).toContain(selector);
      }
    }
    // Questions and answers never change font.
    expect(skin.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/question|answer|flip-card/);
  });

  it('draws focus as an outline outside the edge, which no wobble or shadow can hide', () => {
    const focus = rule(skin, ':root :focus-visible');
    expect(focus).toMatch(/outline:\s*3px solid/);
    expect(focus).toMatch(/outline-offset:\s*[34]px/);
  });

  it('keeps edges, chosen items, progress and focus visible in forced colours', () => {
    const forced = media(skin, '(forced-colors: active)');
    expect(forced).toMatch(/\.chip\[aria-pressed='true'\]/);
    expect(forced).toMatch(/\.main-nav__link\[aria-current='page'\]/);
    expect(forced).toMatch(/\.progress__fill/);
    expect(forced).toMatch(/outline/);
  });

  it('presses buttons down without movement when less motion is asked for', () => {
    expect(media(skin, '(prefers-reduced-motion: reduce)')).toMatch(/transform:\s*none/);
  });
});
