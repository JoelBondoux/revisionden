import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { arenaTextPairs, contrastRatio, textPairs, tokens } from './tokens';

const tokensCss = readFileSync(join(__dirname, 'tokens.css'), 'utf8').toLowerCase();

const requiredTokens = [
  '--color-primary',
  '--color-primary-edge',
  '--color-text',
  '--color-text-secondary',
  '--color-border',
  '--color-surface',
  '--color-background',
  '--color-success',
  '--color-success-edge',
  '--color-warning',
  '--color-warning-text',
  '--color-danger',
  '--color-danger-edge',
  '--color-gold',
  '--color-streak',
  '--color-mastery-fill',
  '--color-weak',
  '--color-locked',
  '--color-locked-soft',
  '--color-challenge',
  '--color-pip',
  '--color-pip-side',
  '--color-pip-ears',
  '--color-pip-muzzle',
  '--font-family',
  '--font-weight-bold',
  '--font-weight-extrabold',
  '--font-weight-black',
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-6',
  '--space-8',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-pill',
  '--shadow-3d-primary',
  '--shadow-3d-success',
  '--shadow-card',
  '--tap-target',
  // The Doodle Diary skin, the app's base look (J13a).
  '--ink',
  '--ink-soft',
  '--paper',
  '--page',
  '--highlight',
  '--highlight-ink',
  '--wobble',
  '--wobble-sm',
  '--lift',
  '--scribble-a',
  '--scribble-b',
  '--font-hand',
] as const;

describe('the Doodle Diary skin tokens (J13a)', () => {
  it('draws on warm paper: cards are paper and the page is a notebook page', () => {
    expect(tokens['--paper']).toBe('#FDFBF4');
    expect(tokens['--page']).toBe('#F6F2E4');
    expect(tokens['--color-surface']).toBe(tokens['--paper']);
    expect(tokens['--color-background']).toBe(tokens['--page']);
  });

  it('edges cards and buttons in pen ink with a hard drawn shadow', () => {
    expect(tokens['--ink']).toBe('#2B2A3A');
    expect(tokens['--lift']).toBe('3px 4px 0 #2B2A3A');
    expect(tokens['--shadow-card']).toBe(tokens['--lift']);
    expect(tokens['--wobble']).toMatch(/\//);
    expect(tokens['--wobble-sm']).toMatch(/\//);
  });

  it('keeps the hand-drawn font for headings, with plain fall-backs', () => {
    expect(tokens['--font-hand']).toMatch(/^'Patrick Hand'/);
    expect(tokens['--font-family']).toMatch(/^'Nunito'/);
  });
});

describe('design tokens', () => {
  it('exports every named token', () => {
    for (const name of requiredTokens) {
      expect(tokens, name).toHaveProperty([name]);
    }
  });

  it('uses the colours from the approved mockups', () => {
    expect(tokens['--color-primary']).toBe('#6C47F5');
    expect(tokens['--color-primary-edge']).toBe('#4B2BC9');
    expect(tokens['--color-text']).toBe('#2B2B3A');
    expect(tokens['--color-success']).toBe('#0B8457');
    expect(tokens['--shadow-3d-primary']).toBe('0 5px 0 #4B2BC9');
    expect(tokens['--color-mastery-fill']).toBe('#D9CFFF');
    expect(tokens['--color-weak']).toBe('#C2541A');
    expect(tokens['--color-locked']).toBe('#C4C4CF');
    expect(tokens['--color-locked-soft']).toBe('#E5E5EC');
    expect(tokens['--color-challenge']).toBe('#2B2B3A');
  });

  it('defines every token in the CSS file with the same value', () => {
    for (const [name, value] of Object.entries(tokens)) {
      expect(tokensCss, name).toContain(`${name}: ${value};`.toLowerCase());
    }
  });
});

describe('contrast check', () => {
  it('measures black on white as 21 to 1 and a colour on itself as 1 to 1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#6C47F5', '#6C47F5')).toBeCloseTo(1, 5);
  });

  it('gives the same answer whichever colour comes first', () => {
    expect(contrastRatio('#2B2B3A', '#FFFFFF')).toBe(contrastRatio('#FFFFFF', '#2B2B3A'));
  });

  it('checks the topic map colour pairs', () => {
    const names = textPairs.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'mastery text on mastery fill',
        'secondary text on locked hex',
        'gold on challenge hex',
        'white on challenge hex',
      ]),
    );
  });

  it.each(textPairs)('$name reaches at least 4.5 to 1', ({ foreground, background }) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('arena theme (practice screens, mockup 22)', () => {
  it('has a deep purple background, chunky answer colours and neon sparks', () => {
    for (const name of [
      '--arena-bg',
      '--arena-raised',
      '--arena-text',
      '--arena-text-secondary',
      '--arena-option-1',
      '--arena-option-2',
      '--arena-option-3',
      '--arena-option-4',
      '--arena-correct',
      '--arena-glow',
      '--arena-spark-0',
      '--arena-spark-3',
    ] as const) {
      expect(tokens, name).toHaveProperty([name]);
    }
  });

  it.each(arenaTextPairs)('$name reaches at least 4.5 to 1', ({ foreground, background }) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps an empty progress track visible: 3 to 1 on the arena (J10f)', () => {
    expect(contrastRatio(tokens['--arena-track'], tokens['--arena-bg'])).toBeGreaterThanOrEqual(3);
  });
});

describe('motion tokens', () => {
  it('matches the timings in the game feel guide', () => {
    expect(tokens['--motion-shake']).toBe('400ms');
    expect(tokens['--motion-burst']).toBe('800ms');
    expect(tokens['--ease-spring']).toMatch(/^cubic-bezier\(/);
  });

  it('never pulses faster than 3 times a second (WCAG 2.3.1)', () => {
    expect(Number.parseInt(tokens['--motion-pulse'], 10)).toBeGreaterThanOrEqual(334);
  });
});
