import { nameStartsWithText } from '../test/nameMatchesText';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DEFAULT_AVATAR, encodeAvatar } from '@revisionden/core';
import { BottomNav, navItemsFor } from './BottomNav';

function renderAt(path: string, cardsDue?: number, avatarCode?: string | null) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNav cardsDue={cardsDue} avatarCode={avatarCode} />
    </MemoryRouter>,
  );
}

const AVATAR = encodeAvatar(DEFAULT_AVATAR);

describe('BottomNav', () => {
  it('links to Home, Learn (the map), Cards and, last, Me (UX-1)', () => {
    renderAt('/map');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const names = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent?.trim());
    expect(names).toEqual(['Home', 'Learn', 'Cards', 'Me']);
    expect(screen.getByRole('link', { name: 'Learn' })).toHaveAttribute('href', '/map');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home');
  });

  it('keeps Plan and Papers out of the bar unless the build asks for them (coming soon)', () => {
    expect(navItemsFor(false).map((i) => i.label)).toEqual(['Home', 'Learn', 'Cards']);
    expect(navItemsFor(true).map((i) => i.label)).toEqual([
      'Home',
      'Learn',
      'Cards',
      'Plan',
      'Papers',
    ]);
  });

  it('the last item, Me, opens settings and personalisation', () => {
    renderAt('/map');
    const links = screen.getAllByRole('link');
    const me = links[links.length - 1]!;
    expect(me).toHaveAccessibleName('Me, settings and personalisation');
    expect(me).toHaveAttribute('href', '/settings');
    // The name starts with the word on screen, for voice control.
    expect(nameStartsWithText(me)).toBe(true);
  });

  it('marks Me as the current page on Settings and on Progress, including its sub-pages', () => {
    for (const path of ['/settings', '/progress', '/progress/subjects']) {
      const { unmount } = renderAt(path);
      expect(
        screen.getByRole('link', { name: 'Me, settings and personalisation' }),
      ).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: 'Learn' })).not.toHaveAttribute('aria-current');
      unmount();
    }
  });

  it('does not mark Me on other pages, such as one that only starts with "progress"', () => {
    for (const path of ['/map', '/progressive']) {
      const { unmount } = renderAt(path);
      expect(
        screen.getByRole('link', { name: 'Me, settings and personalisation' }),
      ).not.toHaveAttribute('aria-current');
      unmount();
    }
  });

  it("shows the student's own avatar, small and decorative, on Me", () => {
    renderAt('/map', 0, AVATAR);
    const me = screen.getByRole('link', { name: 'Me, settings and personalisation' });
    const svg = me.querySelector('svg.avatar-svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(me.querySelector('.main-nav__avatar--placeholder')).toBeNull();
  });

  it('frames the avatar in its own ring, head leaning out, like Pip (J15b-2)', () => {
    renderAt('/map', 0, AVATAR);
    const me = screen.getByRole('link', { name: 'Me, settings and personalisation' });
    expect(me.querySelector('.framed-avatar [data-frame="figure"] svg.avatar-svg')).not.toBeNull();
  });

  it('shows a neutral placeholder on Me until there is an avatar', () => {
    for (const code of [undefined, null]) {
      const { unmount } = renderAt('/map', 0, code);
      const me = screen.getByRole('link', { name: 'Me, settings and personalisation' });
      expect(me.querySelector('.main-nav__avatar--placeholder')).not.toBeNull();
      expect(me.querySelector('svg.avatar-svg')).toBeNull();
      unmount();
    }
  });

  it('marks the current page', () => {
    renderAt('/home');
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Learn' })).not.toHaveAttribute('aria-current');
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
