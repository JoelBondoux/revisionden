import { render, screen } from '@testing-library/react';
import { Pill } from './Pill';

describe('Pill', () => {
  it('renders its label', () => {
    render(<Pill>Weak spot</Pill>);
    expect(screen.getByText('Weak spot')).toHaveClass('pill', 'pill--neutral');
  });

  it('applies the chosen tone', () => {
    render(<Pill tone="streak">3 day streak</Pill>);
    expect(screen.getByText('3 day streak')).toHaveClass('pill--streak');
  });
});
