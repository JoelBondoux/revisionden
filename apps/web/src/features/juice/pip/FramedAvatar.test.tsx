import { render } from '@testing-library/react';
import { FramedAvatar } from './FramedAvatar';

const CODE = 'A0'; // any code; AvatarSvg falls back to the default avatar when it is not valid

// J15b-2 (owner sign-off of the all-themes mockup, 2026-11-26): the player's avatar sits in its own
// ring like Pip, a little smaller: the body is clipped to the disc and the head leans out over the
// top. E9's motion groups are untouched, so it moves the same with any outfit.
describe('the framed avatar', () => {
  it('draws the back of the ring, then the avatar, then the front of the ring', () => {
    const { container } = render(<FramedAvatar code={CODE} />);
    const parts = Array.from(container.querySelectorAll('[data-frame]')).map((el) =>
      el.getAttribute('data-frame'),
    );
    expect(parts).toEqual(['back', 'figure', 'front']);
  });

  it('clips the body to the disc but leaves the head free above it', () => {
    const { container } = render(<FramedAvatar code={CODE} />);
    const clip = container.querySelector('clipPath')!;
    expect(clip).toHaveAttribute('clipPathUnits', 'objectBoundingBox');
    expect(clip.querySelector('rect')).not.toBeNull(); // everything above the disc's middle
    expect(clip.querySelector('circle')).not.toBeNull(); // the disc below it
    const figure = container.querySelector('[data-frame="figure"]') as HTMLElement;
    expect(figure.style.clipPath).toBe(`url(#${clip.id})`);
  });

  it('is decorative, and keeps E9 motion (idle unless still is asked for)', () => {
    const idle = render(<FramedAvatar code={CODE} />);
    const svg = idle.container.querySelector('svg.avatar-svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('data-motion', 'idle');
    const still = render(<FramedAvatar code={CODE} motion="still" />);
    expect(still.container.querySelector('svg.avatar-svg')).toHaveAttribute('data-motion', 'still');
  });

  it('passes a pause on to the avatar (questions and Test mode)', () => {
    const { container } = render(<FramedAvatar code={CODE} paused />);
    expect(container.querySelector('svg.avatar-svg')).toHaveAttribute('data-paused', 'true');
  });
});
