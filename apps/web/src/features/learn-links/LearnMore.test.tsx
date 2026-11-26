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

describe('Learn more with an in-house note', () => {
  it('opens our own note in the app, not in a new tab', async () => {
    const { MemoryRouter } = await import('react-router-dom');
    render(
      <MemoryRouter>
        <LearnMore
          links={[
            {
              title: 'Solving quadratics',
              route: '/notes/gcse-maths-h-a18',
              provider: 'revisionden',
              level: 'GCSE',
              checked_at: null,
            },
          ]}
        />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Learn more' }));
    const link = screen.getByRole('link', { name: /Solving quadratics/ });
    expect(link).toHaveAttribute('href', '/notes/gcse-maths-h-a18');
    expect(link).not.toHaveAttribute('target');
    expect(link).toHaveAccessibleName(/RevisionDen notes/);
    expect(link).not.toHaveAccessibleName(/new tab/);
  });
});
