import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = join(__dirname, '..', '..');
const files = [
  'design/arena.css',
  'design/motion.css',
  'features/juice/juice.css',
  'features/rewards/reveal.css',
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
      for (const property of properties) {
        expect(['transform', 'opacity'], `${file} @keyframes ${name}`).toContain(property);
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
});
