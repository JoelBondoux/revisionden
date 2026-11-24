import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders its content', () => {
    render(<Card>Keep going!</Card>);
    expect(screen.getByText('Keep going!')).toBeInTheDocument();
  });

  it('shows a title as a heading when given one', () => {
    render(<Card title="Today">Two lessons left</Card>);
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  });
});
