import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * J17y (student bug report from a Galaxy Fold: "the touch areas don't match the buttons"): when a
 * button is pressed it only sinks a little (at most 3px, no squash), so it stays under the finger
 * that is pressing it. A bigger jump or squash moved the button away from where it was touched.
 */
const src = join(import.meta.dirname, '..');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

describe('pressed buttons', () => {
  it('sink at most 3px (down, or down and across for a hard shadow) and never squash or shrink', () => {
    const found: string[] = [];
    for (const file of cssFiles(src)) {
      const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (!selector!.includes(':active')) continue;
        const transform = /(?:^|;)\s*transform:\s*([^;]+)/.exec(body!)?.[1]?.trim();
        if (!transform || transform === 'none') continue;
        if (!/^(translateY\([0-3]px\)|translate\([0-3]px, [0-3]px\))$/.test(transform))
          found.push(`${file.slice(src.length + 1)}: ${selector!.trim()} → ${transform}`);
      }
    }
    expect(found).toEqual([]);
  });
});
