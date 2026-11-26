import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EFFECT_STYLE_IDS } from './registry';

const read = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');

// J15s revision (owner, mockup revision 2): every horizontal progress bar is always gently on the
// move, as if eager to be filled, in each style's own way. The motion stays inside the filled part,
// the leading edge pulses, it uses background-position and transform only, stops with reduced
// motion and pauses while the tab is hidden.
describe('living progress bars', () => {
  const css = read('bars.css');

  it('moves inside the fill of every horizontal bar, with a pulsing leading edge', () => {
    for (const fill of ['.progress__fill', '.arena-progress__fill']) {
      expect(css).toContain(`${fill}::before`);
      expect(css).toContain(`${fill}::after`);
    }
    expect(css).toMatch(/overflow:\s*hidden/);
  });

  it('animates only background-position, transform and opacity', () => {
    for (const body of css.match(/@keyframes[^{]+\{[\s\S]*?\n\}/g) ?? []) {
      for (const prop of body.match(/([a-z-]+)\s*:/g) ?? []) {
        expect(['background-position:', 'transform:', 'opacity:']).toContain(
          prop.replace(/\s/g, ''),
        );
      }
    }
  });

  it('stops with reduced motion and pauses while the tab is hidden', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toMatch(/\.tab-hidden[^{]*\{\s*animation-play-state:\s*paused/);
  });

  it.each(EFFECT_STYLE_IDS)('gives %s its own flavour', (id) => {
    expect(css).toContain(`:root[data-effect-style='${id}']`);
  });

  it('is loaded with the app', () => {
    expect(read('EffectStyleProvider.tsx')).toContain("import './bars.css';");
  });

  it('never uses stepped (low frame rate) motion', () => {
    expect(css).not.toMatch(/steps\(/);
  });
});
