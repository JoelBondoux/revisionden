import { screen } from '@testing-library/react';
import { renderRoute } from '../../test/render';

describe('Appearance in Settings', () => {
  it('sits next to Reading comfort for students and parents alike', async () => {
    renderRoute('/settings');
    const appearance = await screen.findByRole('heading', { name: 'Appearance' });
    const reading = screen.getByRole('heading', { name: 'Reading comfort' });
    expect(
      reading.compareDocumentPosition(appearance) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
