/**
 * Dark theme and colour-blind friendly palette (workstream J8). themes.css mirrors these values;
 * themes.test.ts keeps the two in step and checks contrast and colour-blind separation.
 */
import { tokens, type TextPair, type TokenName } from './tokens';

type Palette = Record<string, string>;

/** Every light colour, redefined for the dark theme. Buttons keep their colours and white text. */
export const darkTokens = {
  '--color-primary': '#6C47F5',
  '--color-primary-edge': '#C4B5FF',
  '--color-primary-soft': '#2D2652',
  '--color-text': '#ECEAF5',
  '--color-text-secondary': '#B5B1C8',
  '--color-text-on-primary': '#FFFFFF',
  '--color-text-on-gold': '#2B2B3A',
  '--color-border': '#3A3552',
  '--color-surface': '#1F1B33',
  '--color-background': '#14112A',
  '--color-success': '#0B8457',
  '--color-success-edge': '#8BE7BE',
  '--color-success-soft': '#163A2C',
  '--color-warning': '#FF7A2F',
  '--color-warning-text': '#FFB98A',
  '--color-warning-soft': '#3D2615',
  '--color-danger': '#C62828',
  '--color-danger-edge': '#FF9E9E',
  '--color-gold': '#FFC83D',
  '--color-streak': '#FF9F1C',
  '--color-locked': '#6B6782',
  '--color-locked-soft': '#2C2842',
  '--color-mastery-fill': '#3B3170',
  '--color-weak': '#FF8A4C',
  '--color-challenge': '#0E0C1A',
  '--color-pip': '#FF7A2F',
  '--color-pip-side': '#E35F17',
  '--color-pip-ears': '#3A2622',
  '--color-pip-muzzle': '#F7F3EE',
} as const;

/**
 * Colour-blind friendly: right is blue and wrong is orange (never red against green), checked for
 * deuteranopia, protanopia and tritanopia. Icons and words still carry every meaning too.
 */
export const colourblindTokens = {
  light: {
    '--color-success': '#1F6FD1',
    '--color-success-edge': '#134A8E',
    '--color-success-soft': '#E3EEFB',
    '--color-danger': '#B34F00',
    '--color-danger-edge': '#7A3500',
    '--color-weak': '#B34F00',
    '--arena-correct': '#1F6FD1',
    '--arena-correct-edge': '#134A8E',
  },
  dark: {
    '--color-success': '#1F6FD1',
    '--color-success-edge': '#9CC4F5',
    '--color-success-soft': '#15304F',
    '--color-danger': '#B34F00',
    '--color-danger-edge': '#FFB98A',
    '--color-weak': '#FF9A57',
    '--arena-correct': '#1F6FD1',
    '--arena-correct-edge': '#134A8E',
  },
} as const;

type PairSpec = [name: string, foreground: string, background: string];

/** Text and background pairs used across the app; each must reach 4.5:1 in every theme. */
export const THEME_PAIRS: PairSpec[] = [
  ['body text on surface', '--color-text', '--color-surface'],
  ['body text on background', '--color-text', '--color-background'],
  ['secondary text on surface', '--color-text-secondary', '--color-surface'],
  ['secondary text on background', '--color-text-secondary', '--color-background'],
  ['white on primary button', '--color-text-on-primary', '--color-primary'],
  ['link text on surface', '--color-primary-edge', '--color-surface'],
  ['link text on background', '--color-primary-edge', '--color-background'],
  ['primary text on soft primary', '--color-primary-edge', '--color-primary-soft'],
  ['white on success button', '--color-text-on-primary', '--color-success'],
  ['success text on soft success', '--color-success-edge', '--color-success-soft'],
  ['warning text on surface', '--color-warning-text', '--color-surface'],
  ['warning text on soft warning', '--color-warning-text', '--color-warning-soft'],
  ['white on danger button', '--color-text-on-primary', '--color-danger'],
  ['text on gold', '--color-text-on-gold', '--color-gold'],
  ['mastered hex checkmark', '--color-text-on-gold', '--color-gold'],
  ['text on streak orange', '--color-text-on-gold', '--color-streak'],
  ['mastery text on mastery fill', '--color-primary-edge', '--color-mastery-fill'],
  ['secondary text on locked hex', '--color-text-secondary', '--color-locked-soft'],
  ['gold on challenge hex', '--color-gold', '--color-challenge'],
  ['white on challenge hex', '--color-text-on-primary', '--color-challenge'],
  ['white on right answer (arena)', '--arena-text', '--arena-correct'],
];

/** The pairs with real colours from one palette. */
export function resolvePairs(palette: Palette): TextPair[] {
  return THEME_PAIRS.map(([name, fg, bg]) => ({
    name,
    foreground: palette[fg] ?? tokens[fg as TokenName],
    background: palette[bg] ?? tokens[bg as TokenName],
  }));
}

// Colour-blindness simulation (Machado, Oliveira and Fernandes 2009, full severity) -----------

export type Deficiency = 'protanopia' | 'deuteranopia' | 'tritanopia';

const MATRICES: Record<Deficiency, number[][]> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A colour as seen with a colour vision deficiency, as linear RGB (0 to 1). */
export function simulate(hex: string, deficiency: Deficiency): [number, number, number] {
  const lin = rgb(hex).map(toLinear);
  const m = MATRICES[deficiency];
  return m.map((row) =>
    Math.min(1, Math.max(0, row[0]! * lin[0]! + row[1]! * lin[1]! + row[2]! * lin[2]!)),
  ) as [number, number, number];
}

function lab([r, g, b]: [number, number, number]): [number, number, number] {
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 24389) / 27 / 116 + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIE76 colour difference between two linear RGB colours. */
export function deltaE(a: [number, number, number], b: [number, number, number]): number {
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
