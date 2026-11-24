import { screen } from '@testing-library/react';
import { renderRoute } from '../../test/render';

describe('What your parent can see', () => {
  it('lists, in Settings, exactly which stats the parent can see', async () => {
    renderRoute('/settings');
    const card = await screen.findByRole('region', { name: 'What your parent can see' });
    expect(card).toHaveTextContent('Study time');
    expect(card).toHaveTextContent('never your own words');
  });
});
