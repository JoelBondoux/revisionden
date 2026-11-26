/**
 * Design tokens from the approved mockups. `tokens.css` mirrors these values as CSS variables;
 * a test keeps the two in step. The light theme is the default; `--arena-*` colours are the dark
 * "arena" theme for practice screens (docs/GAME_FEEL.md, mockup 22). Motion tokens set effect timings.
 */
export const tokens = {
  '--color-primary': '#6C47F5',
  '--color-primary-edge': '#4B2BC9',
  '--color-primary-soft': '#EEE9FE',
  '--color-text': '#2B2B3A',
  '--color-text-secondary': '#5E5E73',
  '--color-text-on-primary': '#FFFFFF',
  '--color-text-on-gold': '#2B2B3A',
  '--color-border': '#E3E3EA',
  /** An empty progress track: 3:1 on surface and background (WCAG 1.4.11). */
  '--color-track': '#7F7A90',
  /** Cards are paper and the page is a notebook page (the Doodle Diary skin, J13a). */
  '--color-surface': '#FDFBF4',
  '--color-background': '#F6F2E4',
  '--color-success': '#0B8457',
  '--color-success-edge': '#075C3C',
  '--color-success-soft': '#E3F5EC',
  '--color-warning': '#FF7A2F',
  '--color-warning-text': '#B34F00',
  '--color-warning-soft': '#FFF0E6',
  '--color-danger': '#C62828',
  '--color-danger-edge': '#8E1B1B',
  '--color-gold': '#FFC83D',
  '--color-streak': '#FF9F1C',
  '--color-locked': '#C4C4CF',
  '--color-locked-soft': '#E5E5EC',
  '--color-mastery-fill': '#D9CFFF',
  '--color-weak': '#C2541A',
  '--color-challenge': '#2B2B3A',
  /** The outline of a Challenge hex: 3:1 on the page. */
  '--color-challenge-edge': '#2B2B3A',
  '--color-pip': '#FF7A2F',
  '--color-pip-side': '#E35F17',
  '--color-pip-ears': '#3A2622',
  '--color-pip-muzzle': '#F7F3EE',
  // The Doodle Diary skin, the app's base look (J13a, docs/design/j12/SKIN.md): pen ink edges with
  // wobbly corners and a hard drawn shadow, highlighter for what is chosen, scribbled progress.
  '--ink': '#2B2A3A',
  '--ink-soft': '#57546A',
  '--paper': '#FDFBF4',
  '--page': '#F6F2E4',
  '--highlight': '#FFE45C',
  '--highlight-ink': '#2B2A3A',
  '--scribble-a': '#FFC83D',
  '--scribble-b': '#FFE45C',
  '--wobble': '255px 12px 225px 12px / 12px 225px 12px 255px',
  '--wobble-sm': '18px 6px 16px 7px / 7px 16px 6px 18px',
  '--lift': '3px 4px 0 #2B2A3A',
  '--font-family': "'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif",
  /** Headings only (h1 and card titles); never body text, questions or answers. */
  '--font-hand': "'Patrick Hand', 'Comic Neue', cursive",
  '--font-weight-bold': '700',
  '--font-weight-extrabold': '800',
  '--font-weight-black': '900',
  '--font-size-sm': '0.875rem',
  '--font-size-md': '1rem',
  '--font-size-lg': '1.25rem',
  '--font-size-xl': '1.75rem',
  '--space-1': '4px',
  '--space-2': '8px',
  '--space-3': '12px',
  '--space-4': '16px',
  '--space-6': '24px',
  '--space-8': '32px',
  '--radius-sm': '14px',
  '--radius-md': '16px',
  '--radius-lg': '18px',
  '--radius-pill': '999px',
  '--shadow-3d-primary': '0 5px 0 #4B2BC9',
  '--shadow-3d-success': '0 5px 0 #075C3C',
  '--shadow-3d-danger': '0 5px 0 #8E1B1B',
  '--shadow-3d-neutral': '0 5px 0 #E3E3EA',
  '--shadow-card': '3px 4px 0 #2B2A3A',
  '--focus-ring': '0 0 0 3px #FFFFFF, 0 0 0 6px #6C47F5',
  '--tap-target': '44px',
  '--arena-bg': '#1A1033',
  '--arena-raised': '#2A1A52',
  '--arena-track': '#7C7699',
  '--arena-text': '#FFFFFF',
  '--arena-text-secondary': '#C9BEF0',
  '--arena-option-1': '#6C47F5',
  '--arena-option-1-edge': '#4B2BC9',
  '--arena-option-2': '#0E7490',
  '--arena-option-2-edge': '#0A5468',
  '--arena-option-3': '#B4235A',
  '--arena-option-3-edge': '#7F1940',
  '--arena-option-4': '#A84E00',
  '--arena-option-4-edge': '#733600',
  '--arena-correct': '#0B8457',
  '--arena-correct-edge': '#075C3C',
  '--arena-glow': '#3DF5C8',
  '--arena-gold': '#FFC83D',
  '--arena-spark-0': '#3DF5C8',
  '--arena-spark-1': '#FFC83D',
  '--arena-spark-2': '#FF6FB5',
  '--arena-spark-3': '#8B6CFF',
  '--motion-fast': '150ms',
  '--motion-shake': '400ms',
  '--motion-medium': '500ms',
  '--motion-burst': '800ms',
  '--motion-pulse': '1600ms',
  '--ease-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
  '--ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

export type TokenName = keyof typeof tokens;

export interface TextPair {
  name: string;
  foreground: string;
  background: string;
}

/** Every text and background combination the components use. Each must reach 4.5:1. */
export const textPairs: TextPair[] = [
  {
    name: 'body text on surface',
    foreground: tokens['--color-text'],
    background: tokens['--color-surface'],
  },
  {
    name: 'body text on background',
    foreground: tokens['--color-text'],
    background: tokens['--color-background'],
  },
  {
    name: 'secondary text on surface',
    foreground: tokens['--color-text-secondary'],
    background: tokens['--color-surface'],
  },
  {
    name: 'secondary text on background',
    foreground: tokens['--color-text-secondary'],
    background: tokens['--color-background'],
  },
  {
    name: 'white on primary button',
    foreground: tokens['--color-text-on-primary'],
    background: tokens['--color-primary'],
  },
  {
    name: 'primary text on surface',
    foreground: tokens['--color-primary'],
    background: tokens['--color-surface'],
  },
  {
    name: 'link text (quiet buttons, tiles, inline links) on surface',
    foreground: tokens['--color-primary-edge'],
    background: tokens['--color-surface'],
  },
  {
    name: 'link text on background',
    foreground: tokens['--color-primary-edge'],
    background: tokens['--color-background'],
  },
  {
    name: 'primary text on soft primary',
    foreground: tokens['--color-primary-edge'],
    background: tokens['--color-primary-soft'],
  },
  {
    name: 'white on success button',
    foreground: tokens['--color-text-on-primary'],
    background: tokens['--color-success'],
  },
  {
    name: 'success text on soft success',
    foreground: tokens['--color-success-edge'],
    background: tokens['--color-success-soft'],
  },
  {
    name: 'warning text on surface',
    foreground: tokens['--color-warning-text'],
    background: tokens['--color-surface'],
  },
  {
    name: 'warning text on soft warning',
    foreground: tokens['--color-warning-text'],
    background: tokens['--color-warning-soft'],
  },
  {
    name: 'white on danger button',
    foreground: tokens['--color-text-on-primary'],
    background: tokens['--color-danger'],
  },
  {
    name: 'body text on gold',
    foreground: tokens['--color-text'],
    background: tokens['--color-gold'],
  },
  {
    name: 'body text on streak orange',
    foreground: tokens['--color-text'],
    background: tokens['--color-streak'],
  },
  {
    name: 'mastery text on mastery fill',
    foreground: tokens['--color-primary-edge'],
    background: tokens['--color-mastery-fill'],
  },
  {
    name: 'secondary text on locked hex',
    foreground: tokens['--color-text-secondary'],
    background: tokens['--color-locked-soft'],
  },
  {
    name: 'gold on challenge hex',
    foreground: tokens['--color-gold'],
    background: tokens['--color-challenge'],
  },
  {
    name: 'white on challenge hex',
    foreground: tokens['--color-text-on-primary'],
    background: tokens['--color-challenge'],
  },
];

/** Text on the dark arena theme. Each must reach 4.5:1 (WCAG 2.2 AA). */
export const arenaTextPairs: TextPair[] = [
  ['white on arena background', '--arena-text', '--arena-bg'],
  ['white on raised arena card', '--arena-text', '--arena-raised'],
  ['secondary text on arena background', '--arena-text-secondary', '--arena-bg'],
  ['secondary text on raised arena card', '--arena-text-secondary', '--arena-raised'],
  ['gold on arena background', '--arena-gold', '--arena-bg'],
  ['glow on arena background', '--arena-glow', '--arena-bg'],
  ['white on answer 1', '--arena-text', '--arena-option-1'],
  ['white on answer 2', '--arena-text', '--arena-option-2'],
  ['white on answer 3', '--arena-text', '--arena-option-3'],
  ['white on answer 4', '--arena-text', '--arena-option-4'],
  ['white on right answer', '--arena-text', '--arena-correct'],
  ['dark text on combo badge', '--color-text', '--arena-gold'],
].map(([name, fg, bg]) => ({
  name: name as string,
  foreground: tokens[fg as TokenName],
  background: tokens[bg as TokenName],
}));

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2 contrast ratio between two `#RRGGBB` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}
