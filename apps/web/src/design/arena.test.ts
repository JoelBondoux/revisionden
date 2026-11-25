import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'arena.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the first rule whose selector list includes `selector`. */
function declarations(selector: string): string {
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  const rule = rules.find(([, selectors]) =>
    selectors!.split(',').some((s) => s.trim() === selector),
  );
  return rule?.[2] ?? '';
}

describe('arena theme stylesheet', () => {
  it.each(['.arena .flip-card__face', '.arena .field__input'])(
    'keeps dark text on light cards inside the dark arena (%s)',
    (selector) => {
      expect(declarations(selector)).toContain('color: var(--color-text)');
    },
  );
});
