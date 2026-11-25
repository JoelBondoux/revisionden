import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../../test/render';
import { stubReducedMotion } from '../juice/testing';

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));

beforeEach(() => stubReducedMotion(false));
afterEach(() => vi.unstubAllGlobals());

describe('Starting test in the arena (Test mode rule)', () => {
  it('uses the arena look but shows no right or wrong effects before the reveal', async () => {
    const { container } = renderRoute('/learn/subject/gcse-maths/start');
    await click('Start');
    const option = await screen.findByRole('radio', { name: 'Option B' });
    expect(container.querySelector('.arena')).not.toBeNull();
    expect(screen.getByRole('progressbar', { name: 'Test progress' })).toHaveClass(
      'arena-progress',
    );
    await userEvent.click(option);
    await click('Next');
    await screen.findByLabelText('Your answer');
    for (const effect of ['.burst', '.float-up', '.shake', '.combo-badge', '.answer-option--right'])
      expect(container.querySelector(effect), effect).toBeNull();
  });
});
