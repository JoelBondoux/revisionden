import { screen } from '@testing-library/react';
import { renderRoute } from '../test/render';

describe('Settings', () => {
  it('has My subjects, where the student checks boards and tiers', async () => {
    renderRoute('/settings');
    expect(await screen.findByRole('heading', { name: 'My subjects' })).toBeInTheDocument();
  });

  it('links to the friends league (FL: the league lives under Me)', async () => {
    renderRoute('/settings');
    expect(await screen.findByRole('link', { name: /Friends league/ })).toHaveAttribute(
      'href',
      '/league',
    );
  });
});
