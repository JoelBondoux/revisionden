import { act, render, screen } from '@testing-library/react';
import {
  ArenaProgress,
  ComboBadge,
  Confetti,
  FloatUp,
  ParticleBurst,
  PipSays,
  RollingNumber,
  Shake,
  StarReveal,
} from './effects';
import { stubReducedMotion } from './testing';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('effects with motion allowed', () => {
  beforeEach(() => stubReducedMotion(false));

  it('bursts capped, hidden particles from the chosen option', () => {
    const { container } = render(<ParticleBurst count={200} random={() => 0.5} />);
    const burst = container.querySelector('.burst');
    expect(burst).toHaveAttribute('aria-hidden', 'true');
    expect(burst?.querySelectorAll('.burst__particle').length).toBe(24);
  });

  it('floats +XP up without reading it out twice', () => {
    const { container } = render(<FloatUp>+10 XP</FloatUp>);
    expect(container.querySelector('.float-up')).toHaveAttribute('aria-hidden', 'true');
    expect(container).toHaveTextContent('+10 XP');
  });

  it('shakes only while active', () => {
    const { container, rerender } = render(<Shake active={false}>x</Shake>);
    expect(container.firstChild).not.toHaveClass('shake');
    rerender(<Shake active>x</Shake>);
    expect(container.firstChild).toHaveClass('shake');
  });

  it('pops a combo badge from 2 in a row', () => {
    const { rerender } = render(<ComboBadge combo={1} />);
    expect(screen.queryByText(/combo/i)).not.toBeInTheDocument();
    rerender(<ComboBadge combo={3} />);
    expect(screen.getByText('COMBO ×3')).toBeInTheDocument();
  });

  it('reveals stars one after another and says how many were earned', () => {
    const { container } = render(<StarReveal stars={2} />);
    expect(screen.getByRole('img', { name: '2 of 3 stars' })).toBeInTheDocument();
    const earned = container.querySelectorAll('.star--earned');
    expect(earned).toHaveLength(2);
    expect((earned[1] as HTMLElement).style.animationDelay).toBe('400ms');
  });

  it('throws capped confetti that screen readers ignore', () => {
    const { container } = render(<Confetti count={999} random={() => 0.3} />);
    expect(container.querySelector('.confetti')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('.confetti__piece').length).toBe(40);
  });

  it('rolls the XP counter up to the new total', () => {
    vi.useFakeTimers();
    const { rerender } = render(<RollingNumber value={40} suffix=" XP" label="XP" />);
    rerender(<RollingNumber value={70} suffix=" XP" label="XP" />);
    // The accessible value is the final total straight away.
    expect(screen.getByText('XP: 70 XP')).toBeInTheDocument();
    const digits = screen.getByText('XP: 70 XP').nextElementSibling;
    expect(digits).toHaveAttribute('aria-hidden', 'true');
    expect(digits).not.toHaveTextContent(/^70 XP$/);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(digits).toHaveTextContent(/^70 XP$/);
  });

  it('shows a glowing, springy progress bar with the same meaning as the plain one', () => {
    const { container } = render(<ArenaProgress label="Lesson progress" value={2} max={5} />);
    const bar = screen.getByRole('progressbar', { name: 'Lesson progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    const fill = container.querySelector('.arena-progress__fill') as HTMLElement;
    expect(fill.style.transform).toBe('scaleX(0.4)');
  });

  it('lets Pip say a short line, keeping the established fox art', () => {
    const { container } = render(<PipSays line="Warm-up! Let's go." />);
    expect(screen.getByText("Warm-up! Let's go.")).toBeInTheDocument();
    expect(container.querySelector('svg.pip')).toBeInTheDocument();
  });
});

describe('effects with reduced motion', () => {
  beforeEach(() => stubReducedMotion(true));

  it('turns particles, confetti and float-ups off', () => {
    const { container } = render(
      <>
        <ParticleBurst />
        <Confetti />
        <FloatUp>+10 XP</FloatUp>
      </>,
    );
    expect(container.querySelector('.burst')).toBeNull();
    expect(container.querySelector('.confetti')).toBeNull();
    expect(container.querySelector('.float-up')).toBeNull();
  });

  it('does not shake', () => {
    const { container } = render(<Shake active>x</Shake>);
    expect(container.firstChild).not.toHaveClass('shake');
  });

  it('still shows the combo, stars and XP as plain text', () => {
    render(
      <>
        <ComboBadge combo={4} />
        <StarReveal stars={3} />
        <RollingNumber value={55} suffix=" XP" label="XP" />
      </>,
    );
    expect(screen.getByText('COMBO ×4')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '3 of 3 stars' })).toBeInTheDocument();
    expect(screen.getByText('XP: 55 XP').nextElementSibling).toHaveTextContent(/^55 XP$/);
  });
});
