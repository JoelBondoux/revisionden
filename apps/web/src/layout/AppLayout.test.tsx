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
    renderRoute('/family');
    await screen.findByRole('heading', { level: 1 });
    expect(bugButton().closest('main')).toBeNull();
    expect(screen.getByRole('main')).toHaveClass('has-bug-button');
  });
});
