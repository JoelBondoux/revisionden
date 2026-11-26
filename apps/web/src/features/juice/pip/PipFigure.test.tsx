import { render } from '@testing-library/react';
import { outfitFor, PLAIN } from './outfits';
import { PipFigure, SHOULDER } from './PipFigure';

// J15b (owner, 2026-11-26): Pip leans out of a round frame (the top of the ring behind him, the
// bottom in front), the arm always grows from the shoulder (never a floating paw), and the outfit
// is layered so items combine.
describe('Pip, the figure', () => {
  const layers = (svg: Element) =>
    Array.from(svg.querySelectorAll('[data-layer]')).map((el) => el.getAttribute('data-layer'));

  it('is decorative: hidden from screen readers (the button around it has the name)', () => {
    const { container } = render(<PipFigure outfit={PLAIN} touch="none" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('leans out of the ring: the back of the ring is behind him, the front in front', () => {
    const { container } = render(<PipFigure outfit={PLAIN} touch="none" framed />);
    const order = layers(container.querySelector('svg')!);
    expect(order.indexOf('ring-back')).toBeLessThan(order.indexOf('body'));
    expect(order.indexOf('head')).toBeLessThan(order.indexOf('ring-front'));
    expect(order.indexOf('body')).toBeLessThan(order.indexOf('ring-front'));
  });

  it('draws the arm from the shoulder, turning about it, so it is never disembodied', () => {
    const { container } = render(<PipFigure outfit={PLAIN} touch="none" framed />);
    const arm = container.querySelector('[data-layer="arm"]')!;
    expect(arm).toHaveStyle({ transformOrigin: `${SHOULDER.x}px ${SHOULDER.y}px` });
    const upper = arm.querySelector('.pip__upper-arm')!;
    expect(upper.getAttribute('d')).toMatch(new RegExp(`^M${SHOULDER.x} ${SHOULDER.y}`));
  });

  it('wears the subject item, and shows the prop and tint only when asked (bigger sizes)', () => {
    const maths = outfitFor('gcse-maths');
    const small = render(<PipFigure outfit={maths} touch="none" framed />);
    expect(small.container.querySelector('[data-item="pencil"]')).not.toBeNull();
    expect(small.container.querySelector('[data-prop]')).toBeNull();
    const big = render(<PipFigure outfit={maths} touch="none" framed showProp />);
    expect(big.container.querySelector('[data-prop="protractor"]')).not.toBeNull();
    expect(big.container.querySelector('[data-layer="tint"]')).toHaveAttribute('fill', maths.tint);
  });

  it.each(['moustache', 'bow', 'freckles'] as const)(
    'can wear the %s touch with any outfit',
    (touch) => {
      const { container } = render(<PipFigure outfit={outfitFor('gcse-history')} touch={touch} />);
      expect(container.querySelector(`[data-touch="${touch}"]`)).not.toBeNull();
      expect(container.querySelector('[data-item="explorer-hat"]')).not.toBeNull();
    },
  );

  it('shows a pose as a class, so the stylesheet can move him smoothly', () => {
    const { container } = render(<PipFigure outfit={PLAIN} touch="none" pose="wave" />);
    expect(container.querySelector('svg')).toHaveClass('pip-figure', 'pip-figure--wave');
  });
});
