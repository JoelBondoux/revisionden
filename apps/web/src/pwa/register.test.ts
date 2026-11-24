import { registerServiceWorker } from './register';

describe('registerServiceWorker', () => {
  it('registers the service worker in production', async () => {
    const register = vi.fn().mockResolvedValue({});
    const registered = await registerServiceWorker({ serviceWorker: { register } }, true);
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(registered).toBe(true);
  });

  it('does nothing in development, where the mock API worker runs instead', async () => {
    const register = vi.fn();
    expect(await registerServiceWorker({ serviceWorker: { register } }, false)).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it('does nothing when the browser has no service worker support', async () => {
    expect(await registerServiceWorker({}, true)).toBe(false);
  });

  it('carries on without offline support if registration fails', async () => {
    const register = vi.fn().mockRejectedValue(new Error('blocked'));
    expect(await registerServiceWorker({ serviceWorker: { register } }, true)).toBe(false);
  });
});
