import { screen, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test/render';

const styleRequests = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(([input]) =>
    String(input instanceof Request ? input.url : input).includes('rewards/effect-styles'),
  );

// J10e: the effect style comes with every screen, but Get help makes no API calls at all, even
// for a signed-in child (docs/PRODUCT_RULES.md), so opening it never asks for unlocked styles.
describe('effect styles across the app', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['/help', '/parent/help'])(
    'asks for nothing when %s is opened directly',
    async (path) => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      renderRoute(path);
      expect(await screen.findByRole('button', { name: 'Quick exit' })).toBeInTheDocument();
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('loads the unlocked styles on other screens', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderRoute('/settings');
    await waitFor(() => expect(styleRequests(fetchSpy).length).toBeGreaterThan(0));
  });
});
