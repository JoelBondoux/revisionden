import { screen, within } from '@testing-library/react';
import { renderRoute } from '../test/render';

const bugButton = () => screen.getByRole('button', { name: 'Report a bug' });

describe('the bug button in the student app', () => {
  it('sits in the top row beside the mute button, so it never covers the page', async () => {
    renderRoute('/map');
    await screen.findByRole('heading', { level: 1 });
    const mute = screen.getByRole('button', { name: /sound/i });
    const row = mute.closest('header')!;
    expect(within(row).getByRole('button', { name: 'Report a bug' })).toBe(bugButton());
    expect(row).toHaveClass('sound-header');
  });

  it('still floats in the corner on focused screens, with room left below the page', async () => {
    renderRoute('/learn/daily');
    await screen.findByRole('heading', { level: 1 });
    expect(bugButton().closest('main')).toBeNull();
    expect(screen.getByRole('main')).toHaveClass('has-bug-button');
  });
});

describe('the bug button on parent pages', () => {
  it.each([['/family'], ['/parent'], ['/parent/subjects/00000000-0000-4000-8000-0000000000a1']])(
    'sits in a top row on %s, so it never covers the page',
    async (path) => {
      renderRoute(path, { studentId: null });
      await screen.findByRole('heading', { level: 1 });
      const row = bugButton().closest('header');
      expect(row).toHaveClass('parent-top-row');
      expect(row!.closest('main')).toBe(screen.getByRole('main'));
      expect(screen.getByRole('main')).not.toHaveClass('has-bug-button');
    },
  );
});

// J15b (owner, 2026-11-26): Pip sits top left on every student screen as a round Home button,
// in the top row (the sound and bug buttons stay on the right). In lessons he is there too, and
// asks before leaving.
describe('Pip, the Home button', () => {
  it('starts the top row on student screens', async () => {
    renderRoute('/map');
    await screen.findByRole('heading', { level: 1 });
    const row = screen.getByRole('button', { name: /sound/i }).closest('header')!;
    const buttons = within(row).getAllByRole('button');
    expect(buttons[0]).toHaveAccessibleName('Home');
  });

  it.each([['/learn/daily'], ['/learn/topic/t1']])(
    'is top left in a lesson (%s) and asks before leaving',
    async (path) => {
      renderRoute(path);
      await screen.findByRole('heading', { level: 1 });
      const pip = screen.getByRole('button', { name: 'Home' });
      expect(pip.closest('header')).toHaveClass('lesson-top-row');
      pip.click();
      expect(await screen.findByRole('dialog', { name: 'Leave this lesson?' })).toBeInTheDocument();
    },
  );

  it('is not on parent or public screens', async () => {
    renderRoute('/parent', { studentId: null });
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Home' })).not.toBeInTheDocument();
  });
});
