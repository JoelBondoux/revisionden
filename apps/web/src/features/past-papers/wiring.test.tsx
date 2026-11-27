import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../../test/render';

describe('Past papers wiring', () => {
  it("is reached from a Past papers row on the subject's Learn page", async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/learn/subject/gcse-maths');
    await user.click(await screen.findByRole('link', { name: 'Past papers' }));
    expect(router.state.location.pathname).toBe('/learn/subject/gcse-maths/past-papers');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'GCSE Maths past papers' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });
});
