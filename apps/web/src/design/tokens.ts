/**
 * Design tokens from the approved mockups. `tokens.css` mirrors these values as CSS variables;
 * a test keeps the two in step. Light theme only for now.
 */
export const tokens = {
  '--color-primary': '#6C47F5',
  '--color-primary-edge': '#4B2BC9',
  '--color-primary-soft': '#EEE9FE',
  '--color-text': '#2B2B3A',
  '--color-text-secondary': '#5E5E73',
  '--color-text-on-primary': '#FFFFFF',
  '--color-border': '#E3E3EA',
  '--color-surface': '#FFFFFF',
  '--color-background': '#F7F6FB',
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
  '--color-locked': '#C9C9D4',
  '--color-pip': '#FF7A2F',
  '--color-pip-side': '#E35F17',
  '--color-pip-ears': '#3A2622',
  '--color-pip-muzzle': '#F7F3EE',
  '--font-family': "'Nunito', system-ui, -apple-system, 'Segoe UI', sans-serif",
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
  '--shadow-card': '0 2px 0 #E3E3EA',
  '--focus-ring': '0 0 0 3px #FFFFFF, 0 0 0 6px #6C47F5',
  '--tap-target': '44px',
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
];

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
