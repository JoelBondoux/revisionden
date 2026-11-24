import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('exposes role progressbar with the correct values', () => {
    render(<ProgressBar label="Lesson progress" value={3} max={10} />);
    const bar = screen.getByRole('progressbar', { name: 'Lesson progress' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '10');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
  });

  it('keeps the value between zero and the maximum', () => {
    const { rerender } = render(<ProgressBar label="Goal" value={15} max={10} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
    rerender(<ProgressBar label="Goal" value={-2} max={10} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('describes the value in words when given a value text', () => {
    render(<ProgressBar label="Daily goal" value={20} max={50} valueText="20 of 50 XP" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '20 of 50 XP');
  });
});
