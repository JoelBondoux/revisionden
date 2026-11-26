import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = join(__dirname, '..', '..');
const files = [
  'design/arena.css',
  'design/motion.css',
  'features/juice/juice.css',
  'features/rewards/reveal.css',
  'features/avatar/avatar.css',
  'features/juice/styles/doodle-diary.css',
  'features/juice/styles/sticker-book.css',
  'features/juice/styles/pop-burst.css',
  'features/juice/styles/starlight.css',
  'features/juice/styles/garden-grow.css',
  'features/juice/styles/comic-pop.css',
  'features/juice/styles/pixel-arcade.css',
];
const read = (file: string) => readFileSync(join(src, file), 'utf8');

/** The body of every @keyframes block in a stylesheet. */
function keyframes(css: string): { name: string; body: string }[] {
  const found: { name: string; body: string }[] = [];
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css))) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < css.length) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
      i += 1;
    }
    found.push({ name: match[1]!, body: css.slice(re.lastIndex, i - 1) });
  }
  return found;
}

describe('game feel stylesheets (performance and accessibility rules)', () => {
  it.each(files)('%s animates only transform and opacity', (file) => {
    for (const { name, body } of keyframes(read(file))) {
      const properties = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      // The approved pen-line exception (docs/GAME_FEEL.md): small SVG pen lines may draw on
      // with stroke-dashoffset, in keyframes named pen-*.
      const allowed = name.startsWith('pen-')
        ? ['transform', 'opacity', 'stroke-dashoffset']
        : ['transform', 'opacity'];
      for (const property of properties) {
        expect(allowed, `${file} @keyframes ${name}`).toContain(property);
      }
    }
  });

  it.each(files)('%s switches its animations off for reduced motion', (file) => {
    const css = read(file);
    if (keyframes(css).length > 0) expect(css).toContain('prefers-reduced-motion: reduce');
  });

  it('gives the map, rewards and stats entrance motion and bouncy buttons', () => {
    const css = read('design/motion.css');
    for (const selector of ['.mission', '.hex', '.stat-tile', '.rewards', '.btn']) {
      expect(css).toContain(selector);
    }
  });

  it('never pulses or flashes faster than 3 times a second', () => {
    for (const file of files) {
      for (const match of read(file).matchAll(/animation:[^;]*infinite[^;]*;/g)) {
        expect(match[0], file).toMatch(/var\(--motion-pulse\)/);
      }
    }
  });

  it('draws empty progress tracks and Challenge hex outlines in their contrast-checked colours', () => {
    // J10g: an empty track is an outline (3:1) with nothing inside, so 0% never reads as full.
    expect(read('features/juice/juice.css')).toMatch(
      /\.arena-progress \{[^}]*background: transparent;[^}]*box-shadow: inset 0 0 0 2px var\(--arena-track\)/,
    );
    expect(read('components/components.css')).toMatch(
      /\.progress \{[^}]*background: transparent;[^}]*box-shadow: inset 0 0 0 2px var\(--color-track\)/,
    );
    expect(read('pages/pages.css')).toMatch(
      /\.hex--challenge \.hex__shape \{[^}]*--hex-border: var\(--color-challenge-edge\)/,
    );
  });
});
