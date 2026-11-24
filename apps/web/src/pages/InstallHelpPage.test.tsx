import { screen, within } from '@testing-library/react';
import { renderRoute } from '../test/render';

describe('Add to Home Screen help', () => {
  it('walks through adding the app on an iPad, step by step', async () => {
    renderRoute('/install');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Add RevisionDen to your Home Screen' }),
    ).toBeInTheDocument();
    const steps = within(screen.getByRole('list', { name: 'Steps for iPad' })).getAllByRole(
      'listitem',
    );
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps[0]).toHaveTextContent(/safari/i);
    expect(screen.getByText(/add to home screen/i, { selector: 'strong' })).toBeInTheDocument();
  });

  it('is linked from Settings', async () => {
    renderRoute('/settings');
    expect(await screen.findByRole('link', { name: /add to home screen/i })).toHaveAttribute(
      'href',
      '/install',
    );
  });
});
