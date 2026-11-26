import { screen } from '@testing-library/react';
import { renderRoute } from '../../test/render';

describe('What your parent can see', () => {
  it('lists, in Settings, exactly which stats the parent can see', async () => {
    renderRoute('/settings/more');
    const card = await screen.findByRole('region', { name: 'What your parent can see' });
    expect(card).toHaveTextContent('Study time');
    expect(card).toHaveTextContent('never your own words');
    expect(card).toHaveTextContent(
      'How much of your AI marking allowance you have used this month',
    );
    expect(card.textContent).not.toMatch(/spend|cost|US\$/i);
  });

  it('says that two parents can see it, if two are set up', async () => {
    renderRoute('/settings/more');
    const card = await screen.findByRole('region', { name: 'What your parent can see' });
    expect(card).toHaveTextContent(
      'If your family has two parents set up, both of them can see the same things.',
    );
  });
});
