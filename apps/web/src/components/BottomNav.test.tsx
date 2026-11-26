import { nameStartsWithText } from '../test/nameMatchesText';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from './BottomNav';

function renderAt(path: string, cardsDue?: number) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav cardsDue={cardsDue} />
    </MemoryRouter>,
  );
}

describe('BottomNav', () => {
  it('links to Map, Cards, Plan, Papers and Progress', () => {
    renderAt('/map');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const names = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent?.trim());
    expect(names).toEqual(['Map', 'Cards', 'Plan', 'Papers', 'Progress']);
  });

  it('marks the current page', () => {
    renderAt('/plan');
    expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Map' })).not.toHaveAttribute('aria-current');
  });

  it('shows how many flashcards are due on the Cards tab', () => {
    renderAt('/map', 12);
    const cards = screen.getByRole('link', { name: 'Cards, 12 due' });
    expect(cards).toHaveTextContent('12');
    // The name starts with the words on screen ("Cards 12"), for voice control.
    expect(nameStartsWithText(cards)).toBe(true);
  });

  it('shows no badge when no cards are due', () => {
    renderAt('/map', 0);
    expect(screen.getByRole('link', { name: 'Cards' })).toBeInTheDocument();
  });
});
