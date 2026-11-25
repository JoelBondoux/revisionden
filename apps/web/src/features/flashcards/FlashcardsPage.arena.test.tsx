import { screen } from '@testing-library/react';
import { renderRoute } from '../../test/render';

describe('Flashcard session in the arena (game feel)', () => {
  it('reviews due cards on the dark arena with the glowing progress bar', async () => {
    const { container } = renderRoute('/cards');
    const bar = await screen.findByRole('progressbar', { name: 'Deck progress' });
    expect(bar).toHaveClass('arena-progress');
    expect(container.querySelector('.review.arena')).not.toBeNull();
  });
});
