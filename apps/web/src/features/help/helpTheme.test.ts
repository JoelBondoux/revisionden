import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Get help follows the app's theme (W3). For light, dark and both colour-blind variants, every
 * text colour pair meets WCAG AA (4.5:1) and the Quick exit button and control borders meet the
 * 3:1 non-text contrast rule.
 */
const css = readFileSync(join(__dirname, 'help.css'), 'utf8');
const themesCss = readFileSync(join(__dirname, '..', '..', 'design', 'themes.css'), 'utf8');

function block(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`No block for ${selector}`);
  return Object.fromEntries(
    [...match[1]!.matchAll(/--(help-[a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const light = block('.help-main');
const dark = { ...light, ...block(":root[data-theme='dark'] .help-main") };
const themes = {
  light,
  dark,
  'light colour-blind': { ...light, ...block(":root[data-palette='colourblind'] .help-main") },
  'dark colour-blind': {
    ...dark,
    ...block(":root[data-theme='dark'][data-palette='colourblind'] .help-main"),
  },
};

describe.each(Object.entries(themes))('Get help colours in the %s theme', (_name, t) => {
  it.each([
    ['text', 'help-text', 'help-bg'],
    ['secondary text', 'help-muted', 'help-bg'],
    ['links', 'help-link', 'help-bg'],
    ['text in the private note', 'help-text', 'help-private-bg'],
    ['text in an availability note', 'help-text', 'help-note-bg'],
    ['text in a category heading', 'help-text', 'help-surface-alt'],
    ['secondary text in a category heading', 'help-muted', 'help-surface-alt'],
    ['text in the danger panel', 'help-text', 'help-danger-bg'],
    ['the 999 link in the danger panel', 'help-danger', 'help-danger-bg'],
    ['the Quick exit label', 'help-exit-text', 'help-exit-bg'],
  ])('%s meets AA (4.5:1)', (_what, fg, bg) => {
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['Quick exit against the page', 'help-exit-bg', 'help-bg'],
    ['control borders', 'help-border', 'help-bg'],
    ['the danger panel border', 'help-danger', 'help-bg'],
  ])('%s meets 3:1', (_what, fg, bg) => {
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(3);
  });
});

it('the app theme no longer forces Get help to stay light', () => {
  expect(themesCss).not.toMatch(/\.help-main/);
});
