import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { outfitFor, PLAIN } from './outfits';
import { PipFigure } from './PipFigure';

const look = { family: 'a', variant: 0 } as const;

// J15b-2 (owner sign-off of the all-themes mockup, 2026-11-26): Pip v3 has a bigger head leaning out
// over the top of his ring, shoulders only (no arm), a thin keyline so the ring reads on any disc,
// the subject prop held in front of the ring, and layers that combine freely.
describe('Pip, the figure', () => {
  const layers = (svg: Element) =>
    Array.from(svg.querySelectorAll('[data-layer]')).map((el) => el.getAttribute('data-layer'));

  it('is decorative: hidden from screen readers (the button around it has the name)', () => {
    const { container } = render(<PipFigure outfit={PLAIN} look={look} />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('leans out of the ring: ring back, then shoulders, then head, then the ring front', () => {
    const { container } = render(<PipFigure outfit={PLAIN} look={look} />);
    const order = layers(container.querySelector('svg')!);
    expect(order.indexOf('ring-back')).toBeLessThan(order.indexOf('shoulders'));
    expect(order.indexOf('shoulders')).toBeLessThan(order.indexOf('head'));
    expect(order.indexOf('head')).toBeLessThan(order.indexOf('ring-front'));
  });

  it('has shoulders only, with no arm', () => {
    const { container } = render(<PipFigure outfit={PLAIN} look={look} />);
    expect(container.querySelector('[data-layer="arm"]')).toBeNull();
    expect(container.querySelector('[data-layer="shoulders"]')).not.toBeNull();
  });

  it('draws a keyline inside the ring so it reads against any disc', () => {
    const { container } = render(<PipFigure outfit={PLAIN} look={look} />);
    expect(container.querySelectorAll('.pip-figure__keyline').length).toBeGreaterThan(0);
  });

  it('holds the subject prop in front of the ring, where it reads at button size', () => {
    const { container } = render(<PipFigure outfit={outfitFor('gcse-maths')} look={look} />);
    const order = layers(container.querySelector('svg')!);
    expect(container.querySelector('[data-prop="calculator"]')).not.toBeNull();
    expect(order.indexOf('prop')).toBeGreaterThan(order.indexOf('ring-front'));
  });

  it('shows the worn item and the disc tint', () => {
    const history = outfitFor('gcse-history');
    const { container } = render(<PipFigure outfit={history} look={look} />);
    expect(container.querySelector('[data-item="explorer-hat"]')).not.toBeNull();
    expect(container.querySelector('[data-layer="disc"]')).toHaveAttribute('fill', history.tint);
  });

  it('washes the disc with soft flag colours for a language', () => {
    const { container } = render(<PipFigure outfit={outfitFor('gcse-german')} look={look} />);
    const flag = container.querySelector('[data-layer="flag"]')!;
    expect(flag.querySelectorAll('rect')).toHaveLength(3);
    expect(container.querySelector('[data-layer="flag"] rect')).toHaveAttribute('fill', '#000000');
  });

  it.each([
    ['a', 0],
    ['a', 1],
    ['b', 0],
    ['b', 1],
    ['c', 0],
    ['c', 1],
  ] as const)('can wear look %s%s with any outfit', (family, variant) => {
    const { container } = render(
      <PipFigure outfit={outfitFor('gcse-physics')} look={{ family, variant }} />,
    );
    expect(container.querySelector(`[data-look="${family}${variant}"]`)).not.toBeNull();
    expect(container.querySelector('[data-item="goggles"]')).not.toBeNull();
  });

  it('swaps a beanie for a bandana when the subject already has a hat', () => {
    const hat = render(
      <PipFigure outfit={outfitFor('gcse-french')} look={{ family: 'c', variant: 1 }} />,
    );
    expect(hat.container.querySelector('[data-look-part="beanie"]')).toBeNull();
    expect(hat.container.querySelector('[data-look-part="bandana"]')).not.toBeNull();
    const bare = render(<PipFigure outfit={PLAIN} look={{ family: 'c', variant: 1 }} />);
    expect(bare.container.querySelector('[data-look-part="beanie"]')).not.toBeNull();
  });

  it('breathes only while idle motion is on, never just because he is at rest', () => {
    const css = readFileSync(join(import.meta.dirname, 'pip.css'), 'utf8');
    const breathe = css.slice(0, css.indexOf('animation: pip-breathe'));
    expect(breathe.slice(breathe.lastIndexOf('}') + 1)).toContain(
      '.pip-figure--alive.pip-figure--rest .pip-figure__shoulders',
    );
  });

  it('shows a pose as a class, so the stylesheet can move him smoothly', () => {
    const { container } = render(<PipFigure outfit={PLAIN} look={look} pose="tilt" />);
    expect(container.querySelector('svg')).toHaveClass('pip-figure', 'pip-figure--tilt');
  });

  it('gives every copy its own clip, so two Pips on a page never share one', () => {
    const { container } = render(
      <>
        <PipFigure outfit={PLAIN} look={look} />
        <PipFigure outfit={PLAIN} look={look} />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('clipPath')).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
