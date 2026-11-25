import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LearnItFirst } from './LearnItFirst';
import type { LearnLink } from './links';

const links: LearnLink[] = [
  {
    title: 'Solving quadratic equations by factorising GCSE',
    url: 'https://www.thenational.academy/teachers/q',
    provider: 'oak',
    level: 'GCSE',
    checked_at: '2026-11-25',
  },
];

describe('Learn it first button', () => {
  it('shows nothing for a topic without a checked link', () => {
    const { container } = render(<LearnItFirst links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('opens the free lessons in a new tab only when tapped', async () => {
    render(<LearnItFirst links={links} />);
    const button = screen.getByRole('button', { name: 'Learn it first' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const link = screen.getByRole('link', { name: /Solving quadratic equations by factorising/ });
    expect(link).toHaveAttribute('href', 'https://www.thenational.academy/teachers/q');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent('Oak National Academy');
    expect(link).toHaveAccessibleName(/opens in a new tab/);
  });
});
