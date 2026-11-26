import { FILLERS, HEROES, MOTIFS, radius, seededRandom } from './doodleTile';
import { SKETCH_MOTIFS, sketchMotif, sketchMotifs } from './doodleSketch';

// J8c: the background doodles redrawn by hand (owner decision 2026-11-26: "doodle in a book").
// Generic sketchbook techniques baked into the paths at build time, from a fixed seed.
const drawn = Object.keys(MOTIFS).filter((m) => !FILLERS.includes(m));

describe('hand-drawn doodles', () => {
  it('redraws every doodle except the tiny fillers, which stay crisp', () => {
    for (const name of drawn) expect(SKETCH_MOTIFS[name], name).not.toBe(MOTIFS[name]);
    for (const name of FILLERS) expect(SKETCH_MOTIFS[name]).toBe(MOTIFS[name]);
  });

  it('is the same every time for the same seed, and different for another', () => {
    expect(sketchMotifs()).toEqual(SKETCH_MOTIFS);
    expect(sketchMotifs(8)).not.toEqual(SKETCH_MOTIFS);
  });

  it('stays close to the original shape: wobbles and overshoots, never a different doodle', () => {
    for (const name of drawn) {
      const crisp = radius({ motif: name, scale: 1 });
      const sketch = radius({ motif: name, scale: 1 }, SKETCH_MOTIFS);
      expect(Math.abs(sketch - crisp), name).toBeLessThan(HEROES.includes(name) ? 4 : 3.5);
    }
  });

  it('draws lines only: strokes, the odd double line and light scribbled shading', () => {
    const all = drawn.map((n) => SKETCH_MOTIFS[n]).join('');
    expect(all).not.toMatch(/fill="(?!none)/);
    expect(all).toContain('stroke-opacity=".5"');
    const strokes = sketchMotif('<path d="M-10 0h20"/>', seededRandom(3));
    expect(strokes).toMatch(/^<path d="M[-\d.]+ [-\d.]+l/);
  });
});
