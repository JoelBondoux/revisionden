import { screen } from '@testing-library/react';
import { renderRoute } from './test/render';

describe('routes', () => {
  it.each([
    ['/', 'RevisionDen'],
    ['/family', "Who's revising?"],
    ['/learn', 'Your path'],
    ['/lesson/standard-form', 'Standard form'],
    ['/lesson/demo/complete', 'Lesson complete!'],
    ['/progress', 'Progress'],
    ['/plan', 'Plan'],
    ['/settings', 'Settings'],
    ['/cards', 'Cards'],
    ['/papers', 'Papers'],
    ['/onboarding', "Who's studying?"],
    ['/link', 'Link this device'],
  ])('%s shows the heading "%s"', async (path, heading) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('shows a friendly 404 with a way home for an unknown route', async () => {
    renderRoute('/no-such-page');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to the start/i })).toHaveAttribute('href', '/');
  });

  it('shows the main navigation on app pages', async () => {
    renderRoute('/learn');
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it.each(['/', '/lesson/standard-form', '/onboarding'])(
    'hides the main navigation on %s to keep focus',
    async (path) => {
      renderRoute(path);
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    },
  );

  it('offers a skip link to the main content on app pages', async () => {
    renderRoute('/plan');
    expect(await screen.findByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main',
    );
  });

  it.each(['/learn', '/lesson/standard-form'])(
    'shows the offline banner on %s when offline',
    async (path) => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
      try {
        renderRoute(path);
        expect(await screen.findByText(/you're offline/i)).toBeInTheDocument();
      } finally {
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
      }
    },
  );
});
