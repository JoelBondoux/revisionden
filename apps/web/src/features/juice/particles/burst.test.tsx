import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { stubReducedMotion } from '../testing';
import { MAX_LIVE_PARTICLES } from './plan';
import {
  burstAt,
  burstSound,
  celebrate,
  liveParticles,
  resetParticles,
  useCelebrate,
} from './burst';

function target(): HTMLElement {
  const el = document.createElement('button');
  document.body.appendChild(el);
  return el;
}

const particles = () => document.querySelectorAll('.fx-layer .fx-particle');

describe('particle bursts (J17)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    document.documentElement.dataset.effectStyle = 'pop-burst';
  });
  afterEach(() => {
    resetParticles();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.effectStyle;
    document.body.innerHTML = '';
  });

  it('throws the active style’s particles from an element, in a layer screen readers skip', () => {
    burstAt(target(), { count: 10 });
    const layer = document.querySelector('.fx-layer')!;
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(particles()).toHaveLength(10);
    const shapes = new Set([...particles()].map((p) => p.getAttribute('data-shape')));
    for (const shape of shapes) expect(['coin', 'star4']).toContain(shape);
  });

  it('clears the particles away once they have flown', () => {
    burstAt(target(), { count: 6 });
    expect(liveParticles()).toBe(6);
    vi.advanceTimersByTime(2500);
    expect(particles()).toHaveLength(0);
    expect(liveParticles()).toBe(0);
  });

  it('throws nothing when the device asks for reduced motion', () => {
    stubReducedMotion(true);
    burstAt(target(), { count: 10 });
    celebrate('levelUp', target());
    expect(particles()).toHaveLength(0);
  });

  it('never has more than the cap flying at once', () => {
    const el = target();
    for (let i = 0; i < 10; i++) burstAt(el, { count: 30 });
    expect(particles()).toHaveLength(MAX_LIVE_PARTICLES);
  });

  it('puts the layer inside an open dialog, so the burst shows above it', () => {
    const dialog = document.createElement('dialog');
    const inside = document.createElement('button');
    dialog.appendChild(inside);
    document.body.appendChild(dialog);
    burstAt(inside, { count: 4 });
    expect(dialog.querySelectorAll('.fx-layer .fx-particle')).toHaveLength(4);
  });

  it('shows a comic word in Comic Pop for a big moment', () => {
    document.documentElement.dataset.effectStyle = 'comic-pop';
    celebrate('levelUp', target());
    expect(document.querySelector('.fx-layer .fx-word')?.textContent).toMatch(/!$/);
  });

  it('grows a right answer’s burst with the combo', () => {
    celebrate('correct', target(), { combo: 1 });
    const plain = particles().length;
    resetParticles();
    celebrate('correct', target(), { combo: 9 });
    expect(particles().length).toBeGreaterThan(plain);
  });

  it('does nothing for a missing element', () => {
    expect(() => burstAt(null, { count: 4 })).not.toThrow();
    expect(particles()).toHaveLength(0);
  });

  it('gives components the same calls through useCelebrate', async () => {
    vi.useRealTimers();
    function Cheer() {
      const { celebrate: cheer } = useCelebrate();
      return (
        <button type="button" onClick={(e) => cheer('goal', e.currentTarget)}>
          Cheer
        </button>
      );
    }
    render(<Cheer />);
    await userEvent.click(screen.getByRole('button', { name: 'Cheer' }));
    expect(particles().length).toBeGreaterThan(0);
  });
});

describe('the burst sound (J17)', () => {
  const emit = vi.fn(() => ({ sound: true, haptic: false }));
  const registered = burstSound.event;
  beforeEach(() => {
    stubReducedMotion(false);
    emit.mockClear();
    // As if U8's particleBurst had landed.
    burstSound.event = 'nodePop';
  });
  afterEach(() => {
    burstSound.event = registered;
    resetParticles();
    vi.unstubAllGlobals();
  });

  function Cheer({ times = 1 }: { times?: number }) {
    const { celebrate: cheer } = useCelebrate({ emit, now: () => 5000 });
    return (
      <button
        type="button"
        onClick={(e) => {
          for (let i = 0; i < times; i++) cheer('goal', e.currentTarget);
        }}
      >
        Cheer
      </button>
    );
  }

  it('plays once for bursts close together', async () => {
    render(<Cheer times={3} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cheer' }));
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('stays quiet while U8’s burst sound has not landed', async () => {
    burstSound.event = null;
    render(<Cheer />);
    await userEvent.click(screen.getByRole('button', { name: 'Cheer' }));
    expect(emit).not.toHaveBeenCalled();
  });

  it('stays quiet when nothing flies (reduced motion)', async () => {
    stubReducedMotion(true);
    render(<Cheer />);
    await userEvent.click(screen.getByRole('button', { name: 'Cheer' }));
    expect(emit).not.toHaveBeenCalled();
  });
});
