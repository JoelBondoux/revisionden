import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LearnMore } from './LearnItFirst';
import type { LearnLink } from './links';

const links: LearnLink[] = [
  {
    title: 'Solving quadratic equations by factorising GCSE',
    url: 'https://www.thenational.academy/teachers/q',
    provider: 'oak',
    level: 'GCSE',
    checked_at: '2026-11-25',
    match: {
      page_title: 'Solving quadratic equations by factorising',
      teaches: 'Solving quadratics by factorising, GCSE Higher.',
      level: 'GCSE',
      checked_at: '2026-11-26',
    },
  },
];

describe('Learn more', () => {
  it('shows nothing without a link', () => {
    const { container } = render(<LearnMore links={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('stays tucked behind a tap, then lists free lessons that open in a new tab', async () => {
    render(<LearnMore links={links} />);
    const button = screen.getByRole('button', { name: 'Learn more' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const link = screen.getByRole('link', { name: /Solving quadratic equations by factorising/ });
    expect(link).toHaveAttribute('href', 'https://www.thenational.academy/teachers/q');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAccessibleName(/Oak National Academy.*opens in a new tab/);
  });
});
