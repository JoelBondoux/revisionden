import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, 'avatar.css'), 'utf8');
const design = ['tokens.css', 'themes.css']
  .map((f) => readFileSync(join(__dirname, '../../design', f), 'utf8'))
  .join('\n');

/** The text of the first rule whose selector list is exactly `selector`. */
const rule = (selector: string) => {
  const at = css.indexOf(`\n${selector} {`);
  return at < 0 ? '' : css.slice(at, css.indexOf('}', at));
};

describe('avatar builder layout (J9)', () => {
  it('pins the preview stage while the options scroll', () => {
    expect(rule('.avatar-builder__stage')).toContain('position: sticky');
  });

  it('puts the preview on the left and the options on the right when the builder is wide', () => {
    expect(css).toContain('container-type: inline-size');
    const wide = css.slice(css.indexOf('@container avatar-builder (min-width: 600px)'));
    // The grid must sit on an element inside the container: a container query cannot style
    // the container itself.
    expect(wide).toMatch(/\.avatar-builder__layout \{\s*grid-template-columns/);
  });

  it('shrinks the compact preview without moving the options (margin makes up the height)', () => {
    const compact = rule(".avatar-builder__stage[data-compact='true']");
    // The figure loses --avatar-compact-drop of height; the margin must add the same back.
    expect(compact).toContain('margin-bottom: var(--avatar-compact-drop)');
    expect(rule(".avatar-builder__stage[data-compact='true'] .avatar-builder__figure")).toContain(
      'calc(160px - var(--avatar-compact-drop))',
    );
  });

  it('reserves the preview size so nothing jumps when it renders', () => {
    expect(rule('.avatar-builder__figure')).toMatch(/height: /);
  });

  it('only uses design tokens that exist (or that it defines itself)', () => {
    const defined = new Set([...(design + css).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
    for (const name of used) expect(defined, name).toContain(name);
  });

  it('pins the stage to the very top of a sheet, so nothing shows above it', () => {
    expect(rule('.sheet .avatar-builder__stage')).toContain('top: calc(-1 * var(--space-4))');
  });
});
