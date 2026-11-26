import { screen } from '@testing-library/react';
import { renderRoute } from '../../test/render';

describe('Settings page reminders', () => {
  it('shows the reminders card on the settings page', async () => {
    renderRoute('/settings/more');
    expect(await screen.findByRole('heading', { name: 'Reminders' })).toBeInTheDocument();
    // The test browser has no push support, so it says so instead of offering a button.
    expect(screen.getByText(/can't show reminders/i)).toBeInTheDocument();
  });
});
