import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNav } from './BottomNav';

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe('BottomNav', () => {
  it('links to Learn, Cards, Plan, Papers and Progress', () => {
    renderAt('/learn');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const names = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent);
    expect(names).toEqual(['Learn', 'Cards', 'Plan', 'Papers', 'Progress']);
  });

  it('marks the current page', () => {
    renderAt('/plan');
    expect(screen.getByRole('link', { name: 'Plan' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Learn' })).not.toHaveAttribute('aria-current');
  });
});
