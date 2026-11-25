import { screen } from '@testing-library/react';
import { renderRoute } from '../test/render';

describe('Settings', () => {
  it('has My subjects, where the student checks boards and tiers', async () => {
    renderRoute('/settings');
    expect(await screen.findByRole('heading', { name: 'My subjects' })).toBeInTheDocument();
  });
});
